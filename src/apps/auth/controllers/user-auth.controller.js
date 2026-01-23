import { UserModel } from "../../user/models/user.model.js";
import { sendEmail } from "../../../services/email.service.js";
import { generateUniqueUsername } from '../services/username-generator.js'; 
import { adminWelcomeEmailTemplate } from '../services/email/adminTemplate.js'; 
import { userWelcomeEmailTemplate } from '../services/email/userWelcomeTemplate.js';
import { CampaignModel } from "../../campaign/models/campaign.model.js"; // Add this import
import { PromotionModel } from "../../promotion/models/promotion.model.js"; // Add this import
// import referral service for processing referrals
import { ReferralService } from './../../user/services/referral.service.js';
const referralService = new ReferralService();


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


// Authenticate/Verify User
export const Authenticate = async (req, res) => {
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
      referralCode = null
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
        // Set a placeholder password for social logins to prevent local password authentication.
        // The value should be secure and identifiable.
        //password: `__SOCIAL_${authProvider.toUpperCase().replace(/\./g, '_')}__`,
      };

      // Add email if it exists and is valid
      if (email) {
        newUser.email = email;
      }

      user = await UserModel.create(newUser);

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

      if (displayName && user.displayName !== displayName) {
        updateFields.displayName = displayName;
      }
      if (photoURL && user.avatar !== photoURL) {
        updateFields.avatar = photoURL;
      }
      if (authProvider && user.authenticationMethod !== authProvider) {
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
};


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
          isActive: 1,
          isVerified: 1,
          isMarketingRep: 1,
          // Profile info
          personalInfo: 1,
          professionalInfo: 1,

          // Wallets with last-N transactions
          'wallets.marketer.currency': 1,
          'wallets.marketer.balance': 1,
          'wallets.marketer.reserved': 1,
          'wallets.marketer.transactions': { $slice: ['$wallets.marketer.transactions', -txLimit] },

          'wallets.promoter.currency': 1,
          'wallets.promoter.balance': 1,
          'wallets.promoter.reserved': 1,
          'wallets.promoter.transactions': { $slice: ['$wallets.promoter.transactions', -txLimit] },

          // Saved payout accounts / notification settings (if needed in UI)
          savedAccounts: 1,
          notificationSettings: 1,

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

    if (user.isActive === false) {
      return res.status(403).json({ success: false, message: "This user account is currently inactive or suspended." });
    }

    // 5) Relational fetches (paginate & lean)
    // These can be heavy; return only the most recent items and selected fields.
    const [campaigns, promotions] = await Promise.all([
      CampaignModel.find({ owner: user._id })
        .sort({ createdAt: -1 })
        .limit(campaignsLimit)
        .select('_id title status budget createdAt')
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
        marketerTxCount: user.wallets?.marketer?.transactions?.length ?? 0,
        promoterTxCount: user.wallets?.promoter?.transactions?.length ?? 0,
      },
      message: "User found successfully",
    });
  } catch (error) {
    console.error("Error in GetUser controller:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

