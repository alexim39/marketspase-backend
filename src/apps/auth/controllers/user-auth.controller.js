import { UserModel } from "../../user/models/user/index.js";
import { CampaignModel } from "../../campaign/models/campaign.model.js"; // Add this import
import { PromotionModel } from "../../promotion/models/promotion.model.js"; // Add this import
import { ReferralService } from './../../user/services/referral.service.js';
import { refreshUserReputation } from '../../user/services/user-reputation.service.js';
import { ensureUidSelfOrAdmin } from '../../../shared/utils/request-auth.util.js';
import { verifyFirebaseIdentityToken } from '../../../shared/middleware/auth.middleware.js';
import { generateUniqueUsername } from '../services/username-generator.js';
import { AuthenticateUserUseCase } from '../application/use-cases/authenticate-user.use-case.js';
import { MongooseAuthUserRepository } from '../infrastructure/repositories/mongoose-auth-user.repository.js';
import { AuthActivityLogService } from '../infrastructure/services/auth-activity-log.service.js';
import { AuthWelcomeNotificationService } from '../infrastructure/services/auth-welcome-notification.service.js';
import {
  AuthenticateLocalUserUseCase,
  RegisterOrAttachLocalPasswordUseCase,
  RequestLocalPasswordResetUseCase,
  ResetLocalPasswordUseCase,
} from '../application/use-cases/local-auth.use-case.js';
import { sendEmail } from '../../../core/email.service.js';
import {
  localPasswordResetTemplate,
  localPasswordSetupTemplate,
} from '../services/email/localAuthTemplate.js';

const referralService = new ReferralService();
const authUserRepository = new MongooseAuthUserRepository();
const authActivityLogService = new AuthActivityLogService({ userRepository: authUserRepository });
const authWelcomeNotificationService = new AuthWelcomeNotificationService();

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
  authProviders: 1,
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
    authProviders: Array.isArray(userLike.authProviders) ? userLike.authProviders : [],
    rating: Number(reputationSnapshot.rating ?? userLike.rating ?? 0),
    ratingCount: Number(reputationSnapshot.ratingCount ?? userLike.ratingCount ?? 0),
    createdAt: userLike.createdAt || null,
    updatedAt: userLike.updatedAt || null,
    lastSeenAt: userLike.lastSeenAt || null,
  };
};

const authenticateUserUseCase = new AuthenticateUserUseCase({
  verifyIdentityToken: verifyFirebaseIdentityToken,
  userRepository: authUserRepository,
  activityLogService: authActivityLogService,
  welcomeNotificationService: authWelcomeNotificationService,
  referralService,
  refreshUserReputation,
  generateUsername: generateUniqueUsername,
  projection: AUTH_RESPONSE_PROJECTION,
});

const registerOrAttachLocalPasswordUseCase = new RegisterOrAttachLocalPasswordUseCase({
  userRepository: authUserRepository,
  activityLogService: authActivityLogService,
  welcomeNotificationService: authWelcomeNotificationService,
  referralService,
  refreshUserReputation,
  generateUsername: generateUniqueUsername,
  sendEmail,
  setupEmailTemplate: localPasswordSetupTemplate,
  projection: AUTH_RESPONSE_PROJECTION,
});

const authenticateLocalUserUseCase = new AuthenticateLocalUserUseCase({
  userRepository: authUserRepository,
  activityLogService: authActivityLogService,
  refreshUserReputation,
  projection: AUTH_RESPONSE_PROJECTION,
});

const requestLocalPasswordResetUseCase = new RequestLocalPasswordResetUseCase({
  userRepository: authUserRepository,
  sendEmail,
  resetEmailTemplate: localPasswordResetTemplate,
});

const resetLocalPasswordUseCase = new ResetLocalPasswordUseCase({
  userRepository: authUserRepository,
  activityLogService: authActivityLogService,
  refreshUserReputation,
  projection: AUTH_RESPONSE_PROJECTION,
});

const handleLocalAuthError = (res, error) => {
  console.error("Local Auth Error:", error);

  if (error?.statusCode) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
      code: error.code,
      ...(error.requiresEmailVerification ? { requiresEmailVerification: true } : {}),
    });
  }

  if (error.name === 'ValidationError') {
    return res.status(400).json({ success: false, message: error.message });
  }

  if (error.code === 11000) {
    return res.status(409).json({ success: false, message: "Duplicate email or username." });
  }

  return res.status(500).json({ success: false, message: "Internal server error." });
};

const sendLocalAuthResult = (res, result) => {
  if (result.requiresEmailVerification) {
    res.set('Cache-Control', 'no-store');
    return res.status(result.statusCode || 202).json(result);
  }

  const responseUser = buildAuthResponseUser(result.user, result.reputationSnapshot);

  res.set('Cache-Control', 'no-store');
  return res.status(200).json({
    success: true,
    message: result.message,
    user: responseUser,
    token: result.token,
    isNewUser: Boolean(result.isNewUser),
  });
};


// Authenticate/Verify Usery
export const Authenticate = async (req, res) => {
  try {
    const result = await authenticateUserUseCase.execute(req.body);
    const responseUser = buildAuthResponseUser(result.user, result.reputationSnapshot);

    res.set('Cache-Control', 'no-store');
    return res.status(200).json({
      success: true,
      message: result.message,
      user: responseUser,
    });

  } catch (error) {
    console.error("Auth Error:", error);
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    if (error.code?.startsWith?.('auth/')) {
      return res.status(401).json({ success: false, message: "Invalid or expired Firebase session." });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "Duplicate email or username." });
    }
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

export const LocalSignUp = async (req, res) => {
  try {
    const result = await registerOrAttachLocalPasswordUseCase.execute(req.body);
    return sendLocalAuthResult(res, result);
  } catch (error) {
    return handleLocalAuthError(res, error);
  }
};

export const LocalSignIn = async (req, res) => {
  try {
    const result = await authenticateLocalUserUseCase.execute(req.body);
    return sendLocalAuthResult(res, result);
  } catch (error) {
    return handleLocalAuthError(res, error);
  }
};

export const RequestLocalPasswordReset = async (req, res) => {
  try {
    const result = await requestLocalPasswordResetUseCase.execute(req.body);

    res.set('Cache-Control', 'no-store');
    return res.status(200).json(result);
  } catch (error) {
    return handleLocalAuthError(res, error);
  }
};

export const ResetLocalPassword = async (req, res) => {
  try {
    const result = await resetLocalPasswordUseCase.execute(req.body);
    return sendLocalAuthResult(res, result);
  } catch (error) {
    return handleLocalAuthError(res, error);
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

export const GetCurrentUser = async (req, res) => {
  const uid = req.user?.uid;

  if (!uid) {
    return res.status(404).json({
      success: false,
      message: "User not found.",
    });
  }

  req.params.uid = uid;
  return GetUser(req, res);
};

