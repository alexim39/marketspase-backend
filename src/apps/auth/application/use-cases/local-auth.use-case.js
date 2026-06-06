import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { buildNewAuthUserDraft } from "../../domain/services/provider-profile-reconciliation.service.js";

const LOCAL_PROVIDER = "local";
const CODE_TTL_MS = 15 * 60 * 1000;
const JWT_EXPIRES_IN = process.env.LOCAL_AUTH_JWT_EXPIRES_IN || "7d";
const PASSWORD_POLICY_MESSAGE =
  "Password must be 8-80 characters and include at least one letter and one number.";

const createStatusError = (statusCode, message, code, extra = {}) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  Object.assign(error, extra);
  return error;
};

const normalizeEmail = (value) => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
};

const normalizeDisplayName = (value) => {
  const normalized = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  return normalized || null;
};

const validatePassword = (password) => {
  if (typeof password !== "string" || password.length < 8 || password.length > 80) {
    return false;
  }

  return /[A-Za-z]/.test(password) && /\d/.test(password);
};

const generateLocalUid = () => `local_${crypto.randomUUID().replace(/-/g, "")}`;

const generateVerificationCode = () => String(crypto.randomInt(100000, 1000000));

const hashCode = (code) =>
  crypto
    .createHash("sha256")
    .update(`${process.env.LOCAL_AUTH_CODE_SECRET || process.env.JWTTOKENSECRET || "marketspase-local-auth"}:${code}`)
    .digest("hex");

const verifyCode = (candidate, expectedHash, expiresAt) => {
  if (!candidate || !expectedHash || !expiresAt) {
    return false;
  }

  if (new Date(expiresAt).getTime() < Date.now()) {
    return false;
  }

  const candidateHash = hashCode(String(candidate).trim());
  return crypto.timingSafeEqual(Buffer.from(candidateHash), Buffer.from(expectedHash));
};

const ensureJwtSecret = () => {
  if (!process.env.JWTTOKENSECRET) {
    throw createStatusError(500, "Local authentication is not configured.", "LOCAL_AUTH_NOT_CONFIGURED");
  }
};

const issueLocalToken = (user) => {
  ensureJwtSecret();
  return jwt.sign(
    {
      id: String(user._id),
      authType: LOCAL_PROVIDER,
    },
    process.env.JWTTOKENSECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

const buildProviderProfile = ({ uid, displayName, email, referralCode, userDevice }) => ({
  uid,
  displayName,
  email,
  avatar: "img/avatar.png",
  authenticationMethod: LOCAL_PROVIDER,
  referralCode,
  userDevice,
});

const buildPasswordHash = async (password) => bcrypt.hash(password, 12);

const comparePassword = async (password, hash) => bcrypt.compare(password, hash);

const buildVerificationUpdate = (kind, code) => {
  const prefix = kind === "reset" ? "localAuth.reset" : "localAuth.verification";
  return {
    [`${prefix}CodeHash`]: hashCode(code),
    [`${prefix}CodeExpiresAt`]: new Date(Date.now() + CODE_TTL_MS),
    [`${prefix}RequestedAt`]: new Date(),
  };
};

const createEmailVerificationResult = (message) => ({
  success: true,
  statusCode: 202,
  requiresEmailVerification: true,
  message,
});

export class RegisterOrAttachLocalPasswordUseCase {
  constructor({
    userRepository,
    activityLogService,
    welcomeNotificationService,
    referralService,
    refreshUserReputation,
    generateUsername,
    sendEmail,
    setupEmailTemplate,
    projection,
  }) {
    this.userRepository = userRepository;
    this.activityLogService = activityLogService;
    this.welcomeNotificationService = welcomeNotificationService;
    this.referralService = referralService;
    this.refreshUserReputation = refreshUserReputation;
    this.generateUsername = generateUsername;
    this.sendEmail = sendEmail;
    this.setupEmailTemplate = setupEmailTemplate;
    this.projection = projection;
  }

  async execute({ email, password, displayName, referralCode, userDevice, verificationCode } = {}) {
    const normalizedEmail = normalizeEmail(email);
    const normalizedDisplayName = normalizeDisplayName(displayName);

    if (!normalizedEmail) {
      throw createStatusError(400, "Enter a valid email address.", "INVALID_EMAIL");
    }

    if (!validatePassword(password)) {
      throw createStatusError(400, PASSWORD_POLICY_MESSAGE, "WEAK_PASSWORD");
    }

    const existingUser = await this.userRepository.findLocalAuthByEmail(normalizedEmail);

    if (existingUser) {
      return this.attachPasswordToExistingUser({
        existingUser,
        email: normalizedEmail,
        password,
        userDevice,
        verificationCode,
      });
    }

    if (!normalizedDisplayName) {
      throw createStatusError(400, "Your name is required to create an account.", "DISPLAY_NAME_REQUIRED");
    }

    return this.createLocalUser({
      email: normalizedEmail,
      password,
      displayName: normalizedDisplayName,
      referralCode,
      userDevice,
    });
  }

  async attachPasswordToExistingUser({ existingUser, email, password, userDevice, verificationCode }) {
    if (existingUser.localAuth?.enabled && existingUser.password) {
      throw createStatusError(
        409,
        "This email already has a local password. Please sign in or reset your password.",
        "LOCAL_PASSWORD_EXISTS"
      );
    }

    if (!verificationCode) {
      const code = generateVerificationCode();
      await this.userRepository.updateByIdWithOperators(
        existingUser._id,
        { $set: buildVerificationUpdate("setup", code) },
        this.projection
      );

      await this.sendEmail(
        email,
        "Confirm your MarketSpase email",
        this.setupEmailTemplate({ displayName: existingUser.displayName, code })
      );

      return createEmailVerificationResult(
        "We found an existing MarketSpase profile for this email. Enter the verification code we sent to continue."
      );
    }

    if (
      !verifyCode(
        verificationCode,
        existingUser.localAuth?.verificationCodeHash,
        existingUser.localAuth?.verificationCodeExpiresAt
      )
    ) {
      throw createStatusError(400, "Invalid or expired verification code.", "INVALID_VERIFICATION_CODE");
    }

    const passwordHash = await buildPasswordHash(password);
    const user = await this.userRepository.updateByIdWithOperators(
      existingUser._id,
      {
        $set: {
          password: passwordHash,
          "localAuth.enabled": true,
          "localAuth.passwordSetAt": new Date(),
          lastSeenAt: new Date(),
          ...(userDevice ? { userDevice } : {}),
        },
        $unset: {
          "localAuth.verificationCodeHash": "",
          "localAuth.verificationCodeExpiresAt": "",
          "localAuth.verificationRequestedAt": "",
        },
        $addToSet: { authProviders: LOCAL_PROVIDER },
      },
      this.projection
    );

    await this.activityLogService.record(existingUser._id, {
      action: "password_change",
      description: "Local email/password sign-in enabled",
      metadata: { authenticationMethod: LOCAL_PROVIDER },
    });
    await this.activityLogService.record(existingUser._id, {
      action: "login",
      description: "User logged in with local email/password",
      metadata: { authenticationMethod: LOCAL_PROVIDER, userDevice },
    });

    const reputationSnapshot = await this.refreshUserReputation(user._id);

    return {
      success: true,
      message: "Local sign-in has been enabled for your account.",
      user,
      token: issueLocalToken(user),
      isNewUser: false,
      reputationSnapshot,
    };
  }

  async createLocalUser({ email, password, displayName, referralCode, userDevice }) {
    const now = new Date();
    const providerProfile = buildProviderProfile({
      uid: generateLocalUid(),
      displayName,
      email,
      referralCode,
      userDevice,
    });
    const username = await this.generateUsername(displayName || "User");
    const passwordHash = await buildPasswordHash(password);
    const createData = {
      ...buildNewAuthUserDraft(providerProfile, { username, now }),
      password: passwordHash,
      authenticationMethod: LOCAL_PROVIDER,
      authProviders: [LOCAL_PROVIDER],
      localAuth: {
        enabled: true,
        passwordSetAt: now,
      },
    };

    const user = await this.userRepository.createUser(createData, this.projection);

    if (referralCode) {
      try {
        await this.referralService.processReferral(user._id, referralCode, user.role);
        await this.activityLogService.record(user._id, {
          action: "referred_signup",
          description: `Joined using referral from ${referralCode}`,
          metadata: { referralCode },
        });
      } catch (error) {
        console.error("Local auth referral failed:", error);
      }
    }

    await this.welcomeNotificationService.sendNewUserNotifications(user);
    await this.activityLogService.record(user._id, {
      action: "signup",
      description: "New local account created",
      metadata: { authenticationMethod: LOCAL_PROVIDER },
    });
    await this.activityLogService.record(user._id, {
      action: "login",
      description: "User logged in with local email/password",
      metadata: { authenticationMethod: LOCAL_PROVIDER, userDevice },
    });

    const reputationSnapshot = await this.refreshUserReputation(user._id);

    return {
      success: true,
      message: "Account created",
      user,
      token: issueLocalToken(user),
      isNewUser: true,
      reputationSnapshot,
    };
  }
}

export class AuthenticateLocalUserUseCase {
  constructor({ userRepository, activityLogService, refreshUserReputation, projection }) {
    this.userRepository = userRepository;
    this.activityLogService = activityLogService;
    this.refreshUserReputation = refreshUserReputation;
    this.projection = projection;
  }

  async execute({ email, password, userDevice } = {}) {
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || typeof password !== "string" || !password) {
      throw createStatusError(401, "Wrong email or password.", "INVALID_CREDENTIALS");
    }

    const existingUser = await this.userRepository.findLocalAuthByEmail(normalizedEmail);

    if (!existingUser) {
      throw createStatusError(401, "Wrong email or password.", "INVALID_CREDENTIALS");
    }

    if (!existingUser.localAuth?.enabled || !existingUser.password) {
      throw createStatusError(
        428,
        "Local password is not set for this account. Please create one first.",
        "LOCAL_PASSWORD_NOT_SET"
      );
    }

    const passwordMatches = await comparePassword(password, existingUser.password);
    if (!passwordMatches) {
      throw createStatusError(401, "Wrong email or password.", "INVALID_CREDENTIALS");
    }

    if (existingUser.isActive === false) {
      throw createStatusError(403, "This account is inactive or suspended.", "ACCOUNT_INACTIVE");
    }

    const user = await this.userRepository.updateByIdWithOperators(
      existingUser._id,
      {
        $set: {
          lastSeenAt: new Date(),
          "localAuth.passwordLastUsedAt": new Date(),
          ...(userDevice ? { userDevice } : {}),
        },
        $addToSet: { authProviders: LOCAL_PROVIDER },
      },
      this.projection
    );

    await this.activityLogService.record(user._id, {
      action: "login",
      description: "User logged in with local email/password",
      metadata: { authenticationMethod: LOCAL_PROVIDER, userDevice },
    });

    const reputationSnapshot = await this.refreshUserReputation(user._id);

    return {
      success: true,
      message: "Signed in successfully",
      user,
      token: issueLocalToken(user),
      isNewUser: false,
      reputationSnapshot,
    };
  }
}

export class RequestLocalPasswordResetUseCase {
  constructor({ userRepository, sendEmail, resetEmailTemplate }) {
    this.userRepository = userRepository;
    this.sendEmail = sendEmail;
    this.resetEmailTemplate = resetEmailTemplate;
  }

  async execute({ email } = {}) {
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      throw createStatusError(400, "Enter a valid email address.", "INVALID_EMAIL");
    }

    const existingUser = await this.userRepository.findLocalAuthByEmail(normalizedEmail);

    if (!existingUser || !existingUser.localAuth?.enabled || !existingUser.password) {
      return {
        success: true,
        message: "If this email has a local password, a reset code has been sent.",
      };
    }

    const code = generateVerificationCode();
    await this.userRepository.updateByIdWithOperators(existingUser._id, {
      $set: buildVerificationUpdate("reset", code),
    });

    await this.sendEmail(
      normalizedEmail,
      "Reset your MarketSpase password",
      this.resetEmailTemplate({ displayName: existingUser.displayName, code })
    );

    return {
      success: true,
      message: "If this email has a local password, a reset code has been sent.",
    };
  }
}

export class ResetLocalPasswordUseCase {
  constructor({ userRepository, activityLogService, refreshUserReputation, projection }) {
    this.userRepository = userRepository;
    this.activityLogService = activityLogService;
    this.refreshUserReputation = refreshUserReputation;
    this.projection = projection;
  }

  async execute({ email, password, verificationCode, userDevice } = {}) {
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      throw createStatusError(400, "Enter a valid email address.", "INVALID_EMAIL");
    }

    if (!validatePassword(password)) {
      throw createStatusError(400, PASSWORD_POLICY_MESSAGE, "WEAK_PASSWORD");
    }

    const existingUser = await this.userRepository.findLocalAuthByEmail(normalizedEmail);

    if (
      !existingUser ||
      !existingUser.localAuth?.enabled ||
      !verifyCode(
        verificationCode,
        existingUser.localAuth?.resetCodeHash,
        existingUser.localAuth?.resetCodeExpiresAt
      )
    ) {
      throw createStatusError(400, "Invalid or expired reset code.", "INVALID_RESET_CODE");
    }

    const passwordHash = await buildPasswordHash(password);
    const user = await this.userRepository.updateByIdWithOperators(
      existingUser._id,
      {
        $set: {
          password: passwordHash,
          "localAuth.passwordSetAt": new Date(),
          "localAuth.passwordLastUsedAt": new Date(),
          lastSeenAt: new Date(),
          ...(userDevice ? { userDevice } : {}),
        },
        $unset: {
          "localAuth.resetCodeHash": "",
          "localAuth.resetCodeExpiresAt": "",
          "localAuth.resetRequestedAt": "",
        },
        $addToSet: { authProviders: LOCAL_PROVIDER },
      },
      this.projection
    );

    await this.activityLogService.record(user._id, {
      action: "password_change",
      description: "Local password reset completed",
      metadata: { authenticationMethod: LOCAL_PROVIDER },
    });
    await this.activityLogService.record(user._id, {
      action: "login",
      description: "User logged in after local password reset",
      metadata: { authenticationMethod: LOCAL_PROVIDER, userDevice },
    });

    const reputationSnapshot = await this.refreshUserReputation(user._id);

    return {
      success: true,
      message: "Password reset successfully",
      user,
      token: issueLocalToken(user),
      isNewUser: false,
      reputationSnapshot,
    };
  }
}
