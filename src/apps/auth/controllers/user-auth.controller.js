import { UserModel } from "../../user/models/user/index.js";
import { sendEmail } from "../../../core/email.service.js";
import { generateUniqueUsername } from '../services/username-generator.js'; 
import { adminWelcomeEmailTemplate } from '../services/email/adminTemplate.js'; 
import { userWelcomeEmailTemplate } from '../services/email/userWelcomeTemplate.js';
import { CampaignModel } from "../../campaign/models/campaign.model.js"; // Add this import
import { PromotionModel } from "../../promotion/models/promotion.model.js"; // Add this import
// import referral service for processing referrals
import { ReferralService } from './../../user/services/referral.service.js';
import { refreshUserReputation } from '../../user/services/user-reputation.service.js';
import { ensureUidSelfOrAdmin } from '../../../shared/utils/request-auth.util.js';
import { verifyFirebaseIdentityToken } from '../../../shared/middleware/auth.middleware.js';
const referralService = new ReferralService();

const sortAndLimitTransactions = (transactions = [], limit = 20) => {
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return [];
  }

  return [...transactions]
    .sort((left, right) => {
      const leftTime = new Date(left?.createdAt || left?.processedAt || 0).getTime();
      const rightTime = new Date(right?.createdAt || right?.processedAt || 0).getTime();
      return rightTime - leftTime;
    })
    .slice(0, limit);
};

const AUTH_RESPONSE_PROJECTION = {
  _id: 1,
  uid: 1,
  username: 1,
  displayName: 1,
  email: 1,
  avatar: 1,
  role: 1,
  type: 1,
  isActive: 1,
  isVerified: 1,
  authenticationMethod: 1,
  rating: 1,
  ratingCount: 1,
  ratingUpdatedAt: 1,
  createdAt: 1,
  updatedAt: 1,
  lastSeenAt: 1,
};

const buildAuthResponseUser = (userLike, reputationSnapshot = {}) => {
  if (!userLike) {
    return null;
  }

  return {
    _id: userLike._id,
    uid: userLike.uid,
    username: userLike.username,
    displayName: userLike.displayName,
    email: userLike.email || null,
    avatar: userLike.avatar || null,
    role: userLike.role || 'marketer',
    type: userLike.type || 'user',
    isActive: userLike.isActive !== false,
    isVerified: Boolean(userLike.isVerified),
    authenticationMethod: userLike.authenticationMethod || 'google.com',
    rating: Number(reputationSnapshot.rating ?? userLike.rating ?? 0),
    ratingCount: Number(reputationSnapshot.ratingCount ?? userLike.ratingCount ?? 0),
    createdAt: userLike.createdAt || null,
    updatedAt: userLike.updatedAt || null,
    lastSeenAt: userLike.lastSeenAt || null,
  };
};


const logActivitySafe = async (userId, activity) => {
  try {
    await UserModel.updateOne(
      { _id: userId },
      {
        $push: {
          activityLog: {
            $each: [activity],
            $slice: -200 // prevent unbounded growth
          }
        }
      }
    );
  } catch (err) {
    console.warn('Activity log failed:', err.message);
  }
};


// Authenticate/Verify Usery
export const Authenticate = async (req, res) => {
  try {
    const { firebaseUser = {}, idToken } = req.body;

    // 1. Validate Input
    if (!idToken) {
      return res.status(401).json({ success: false, message: "Missing Firebase identity token" });
    }

    const decodedToken = await verifyFirebaseIdentityToken(idToken);
    const {
      uid = decodedToken.uid,
      displayName = decodedToken.name || firebaseUser.displayName,
      email = decodedToken.email || firebaseUser.email,
      photoURL = decodedToken.picture || firebaseUser.photoURL,
      providerData,
      referralCode = null,
      userDevice = null,
    } = firebaseUser;

    if (!uid) {
      return res.status(400).json({ success: false, message: "Missing Firebase user data" });
    }

    const authProvider = providerData?.[0]?.providerId || 'local';

    // 2. Atomic Find or Update
    // Using findOneAndUpdate with upsert:true simplifies the logic and ensures the 'else' logic (updates) always runs.
    const updateData = {
      uid,
      displayName: displayName || 'User',
      avatar: photoURL || 'img/avatar.png',
      userDevice,
      authenticationMethod: authProvider,
      lastSeenAt: new Date(),
    };

    if (email) updateData.email = email;

    // findOneAndUpdate returns a 'raw' result if includeResultMetadata is true, 
    // allowing us to see if a new document was created (upserted).
    const result = await UserModel.findOneAndUpdate(
      { $or: [{ uid }, { email: email || '____NO_EMAIL____' }] },
      { $set: updateData },
      { 
        upsert: true, 
        new: true, 
        runValidators: true, 
        setDefaultsOnInsert: true,
        includeResultMetadata: true,
        projection: AUTH_RESPONSE_PROJECTION,
      }
    );

   

    const user = result.value;
    const isNewUser = !result.lastErrorObject.updatedExisting;

    // 3. Post-Auth Logic (New User vs Returning User)
    if (isNewUser) {
      // NEW USER LOGIC
      const username = await generateUniqueUsername(displayName);
      await UserModel.updateOne({ _id: user._id }, { $set: { username } });
      user.username = username; // Update local object for response/emails

      // Process Referral
      if (referralCode) {
        try {
          await referralService.processReferral(user._id, referralCode, user.role);
          await logActivitySafe(user._id, {
            action: 'referred_signup',
            description: `Joined using referral from ${referralCode}`,
            metadata: { referralCode }
          });
        } catch (err) {
          console.error('Referral failed:', err);
        }
      }

      // Send Welcome Emails
      try {
        const ownerEmails = ['schooltraz@gmail.com'];
        const ownerMsg = adminWelcomeEmailTemplate(user);
        const userMsg = userWelcomeEmailTemplate(user);
        
        await Promise.all([
          ...ownerEmails.map(m => sendEmail(m, 'New Sign Up', ownerMsg)),
          user.email ? sendEmail(user.email, 'Welcome to MarketSpase', userMsg) : Promise.resolve()
        ]);
      } catch (err) {
        console.error('Email delivery failed:', err);
      }

      await logActivitySafe(user._id, { action: 'signup', description: 'New account created' });
      console.log(`New user: ${user.username} via ${authProvider}`);

    } else {
      // RETURNING USER LOGIC
      await logActivitySafe(user._id, { 
        action: 'login', 
        description: 'User logged in',
        metadata: { userDevice } 
      });
      console.log(`User logged in: ${user.username}`);
    }

    // 4. Final Response
    const reputationSnapshot = await refreshUserReputation(user._id);
    const responseUser = buildAuthResponseUser(user, reputationSnapshot);

    res.set('Cache-Control', 'no-store');
    return res.status(200).json({
      success: true,
      message: isNewUser ? "Account created" : "Signed in successfully",
      user: responseUser,
    });

  } catch (error) {
    console.error("Auth Error:", error);
    if (error.code?.startsWith?.('auth/')) {
      return res.status(401).json({ success: false, message: "Invalid or expired Firebase session." });
    }
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "Duplicate email or username." });
    }
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};


/* export const Authenticate = async (req, res) => {
  try {
    const { firebaseUser } = req.body;

    // 1. Input Validation and Null Checks
    if (!firebaseUser) {
      return res.status(400).json({ success: false, message: "Missing Firebase user data" });
    }

    // Extract necessary data from firebaseUser
    const {
      uid,
      displayName,
      email,
      photoURL,
      providerData,
      referralCode = null,
      userDevice,
    } = firebaseUser;

    // Determine authentication method from providerData
    const authProvider = providerData?.[0]?.providerId || 'local';

    // 2. Handle cases where email is not provided (e.g., Twitter)
    // We'll use the unique Firebase UID to find/create the user.
    // Let's create a combined unique identifier for the database
    //const uniqueIdentifier = email ? email : uid;

    let user = await UserModel.findOne({
      $or: [
        { email },
        { uid } 
      ]
    });

    // 3. User Existence Check and Creation
    if (!user) {
      // User does not exist, so create a new one.
      const username = await generateUniqueUsername(displayName);

      const newUser = {
        uid,
        displayName: displayName || 'User',
        username: username,
        authenticationMethod: authProvider,
        avatar: photoURL || 'img/avatar.png',
        userDevice,
        // Set a placeholder password for social logins to prevent local password authentication.
        // The value should be secure and identifiable.
        //password: `__SOCIAL_${authProvider.toUpperCase().replace(/\./g, '_')}__`,
      };

      // Add email if it exists and is valid
      if (email) {
        newUser.email = email;
      }

      user = await UserModel.create(newUser);

      await UserModel.updateOne(
        { _id: user._id },
        { $set: { lastSeenAt: new Date() } }
      );

    // Process referral if provided
    if (referralCode) {
      try {
        await referralService.processReferral(user._id, referralCode, user.role);
        
        // Log the referral activity
        await logActivitySafe(user._id, {
          action: 'referred_signup',
          description: `Joined using referral from ${referralCode}`,
          createdAt: new Date(),
          metadata: { referrerUsername: referralCode }
        });
        console.error('Referral sign up with code:', referralCode);
      } catch (referralError) {
        console.error('Referral processing failed:', referralError);
        // Don't fail registration if referral processing fails
      }
    }
      
      // Save the user to the database
      // await user.save(); // `create` method already saves the document.

      // Log the new user creation for monitoring
      //console.log(`New user created: ${user.username} via ${authProvider}`);

      //Send email to form owner
      const ownerSubject = 'New MarketSpase Sign Up';
      const ownerMessage = adminWelcomeEmailTemplate(user);
      const ownerEmails = ['schooltraz@gmail.com'];
      await Promise.all(ownerEmails.map(email => sendEmail(email, ownerSubject, ownerMessage)));

      //Send welcome email to the user
      const userSubject = 'Welcome to MarketSpase';
      const userMessage = userWelcomeEmailTemplate(user);
      await sendEmail(user.email, userSubject, userMessage);

      // user activity log
      await logActivitySafe(user._id, {
        action: 'login',
        description: `You signed up a new account account`,
        createdAt: new Date(),
        metadata: { referrerUsername: referralCode }
      });
      console.log(`User ${user.username} signed up via ${authProvider}.`);

    } else {
      // 4. User Exists, Update Information
      // A user already exists, let's update their data if necessary.
      // This is useful for keeping their profile picture, display name, etc. up to date.
      // We'll update the `displayName` and `avatar` if they've changed.
      const updateFields = {};

      if (user.userDevice != userDevice) {
        updateFields.userDevice = userDevice;
      }
      if (user.displayName != displayName) {
        updateFields.displayName = displayName;
      }
      if (user.avatar != photoURL) {
        updateFields.avatar = photoURL;
      }
      if (user.authenticationMethod != authProvider) {
        updateFields.authenticationMethod = authProvider;
      }
      if (Object.keys(updateFields).length > 0) {
        await UserModel.updateOne({ _id: user._id }, { $set: updateFields });
        // Re-fetch the user to get the updated document, or update the `user` object in memory.
        Object.assign(user, updateFields);
      }

      // user activity log
      await logActivitySafe(user._id, {
        action: 'login',
        description: `New account creation and login`,
        createdAt: new Date(),
        metadata: { referrerUsername: referralCode }
      });
      console.log(`User ${user.username} logged in via ${authProvider}.`);

      await UserModel.updateOne(
        { _id: user._id },
        { $set: { lastSeenAt: new Date() } }
      );
      
    }

    // 5. Respond with the User Data
    // Exclude the sensitive password field from the response.
    const userObject = user.toObject({ versionKey: false });
    delete userObject.password;

    res.status(200).json({
      success: true,
      message: `Signed in successfully with ${authProvider}`,
      //user: userObject,
    });

  } catch (error) {
    console.error("Authentication Error:", error);
    // Handle potential duplicate username/email errors gracefully
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "A user with this email or username already exists." });
    }
    res.status(500).json({ success: false, message: "Internal server error during authentication." });
  }
}; */




/**
 * GET /api/users/:uid?txLimit=20&campaignsLimit=10&promotionsLimit=10
 * - txLimit is clamped to [15..30], default 20
 */
export const GetUser = async (req, res) => {
  try {
    // 1) Validate UID
    const { uid } = req.params;
    if (!uid) {
      return res.status(400).json({ success: false, message: "User ID (UID) is required." });
    }

    if (!ensureUidSelfOrAdmin(req, uid, res, "You are not authorized to access this user record")) {
      return;
    }

    // 2) Derive safe limits
    const clamp = (num, min, max) =>
      Number.isFinite(num) ? Math.max(min, Math.min(max, Math.trunc(num))) : undefined;

    const txLimit = clamp(Number(req.query.txLimit), 15, 30) ?? 20;
    const campaignsLimit = clamp(Number(req.query.campaignsLimit), 5, 50) ?? 10;
    const promotionsLimit = clamp(Number(req.query.promotionsLimit), 5, 50) ?? 10;

    // 3) Aggregation: slice heavy arrays and include only required fields
    const userAgg = await UserModel.aggregate([
      { $match: { uid } },
      // Early filter (optional)
      { $match: { isDeleted: { $ne: true } } },

      {
        $project: {
          // Identity / core
          _id: 1,
          uid: 1,
          username: 1,
          displayName: 1,
          email: 1,
          avatar: 1,
          role: 1,
          type: 1,
          isActive: 1,
          isVerified: 1,
          isMarketingRep: 1,
          rating: 1,
          ratingCount: 1,
          ratingUpdatedAt: 1,
          // Profile info
          personalInfo: 1,
          professionalInfo: 1,

          // Wallets with last-N transactions
          'wallets.marketer.currency': 1,
          'wallets.marketer.balance': 1,
          'wallets.marketer.reserved': 1,
          'wallets.marketer.transactions': 1,

          'wallets.promoter.currency': 1,
          'wallets.promoter.balance': 1,
          'wallets.promoter.reserved': 1,
          'wallets.promoter.transactions': 1,

          // Saved payout accounts / notification settings (if needed in UI)
          savedAccounts: 1,
          notificationSettings: 1,
          loginStreak: 1,
          badgeProfile: 1,
          gamificationProfile: 1,

          // Cap activityLog to keep payload light (optional)
          activityLog: { $slice: ['$activityLog', 100] },

          // DO NOT exclude fields here (no mixing); we'll $unset next.
          // password: 0   <-- removed
        }
      },

      // 4) Secure: remove sensitive fields AFTER inclusion projection
      { $unset: ['password'] },
    ]).exec();

    if (!userAgg || userAgg.length === 0) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const user = userAgg[0];
    const reputationSnapshot = await refreshUserReputation(user);
    user.rating = reputationSnapshot.rating;
    user.ratingCount = reputationSnapshot.ratingCount;

    const marketerTransactions = Array.isArray(user.wallets?.marketer?.transactions)
      ? user.wallets.marketer.transactions
      : [];
    const promoterTransactions = Array.isArray(user.wallets?.promoter?.transactions)
      ? user.wallets.promoter.transactions
      : [];

    if (user.wallets?.marketer) {
      user.wallets.marketer.transactions = sortAndLimitTransactions(marketerTransactions, txLimit);
    }

    if (user.wallets?.promoter) {
      user.wallets.promoter.transactions = sortAndLimitTransactions(promoterTransactions, txLimit);
    }

    await UserModel.updateOne(
      { _id: user._id },
      { $set: { lastSeenAt: new Date() } }
    );

    if (user.isActive === false) {
      return res.status(403).json({ success: false, message: "This user account is currently inactive or suspended." });
    }

    // 5) Relational fetches (paginate & lean)
    // These can be heavy; return only the most recent items and selected fields.
    const [campaigns, promotions] = await Promise.all([
      CampaignModel.find({ owner: user._id })
        .sort({ createdAt: -1 })
        .limit(campaignsLimit)
        .select('_id title status budget spentBudget currentPromoters createdAt')
        .lean()
        .catch(() => []),

      PromotionModel.find({ promoter: user._id })
        .sort({ createdAt: -1 })
        .limit(promotionsLimit)
        .select('_id campaign status earnings createdAt')
        .lean()
        .catch(() => []),
    ]);

    // 6) Response
    return res.status(200).json({
      success: true,
      data: {
        ...user,
        campaigns,
        promotion: promotions,
      },
      meta: {
        txLimit,
        campaignsLimit,
        promotionsLimit,
        marketerTxCount: marketerTransactions.length,
        promoterTxCount: promoterTransactions.length,
      },
      message: "User found successfully",
    });
  } catch (error) {
    console.error("Error in GetUser controller:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

