import { ProviderProfile } from "../../domain/value-objects/provider-profile.js";
import {
  buildExistingUserSyncUpdate,
  buildNewAuthUserDraft,
  buildNewUserSyncedFields,
} from "../../domain/services/provider-profile-reconciliation.service.js";

const createStatusError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export class AuthenticateUserUseCase {
  constructor({
    verifyIdentityToken,
    userRepository,
    activityLogService,
    welcomeNotificationService,
    referralService,
    refreshUserReputation,
    generateUsername,
    projection,
  }) {
    this.verifyIdentityToken = verifyIdentityToken;
    this.userRepository = userRepository;
    this.activityLogService = activityLogService;
    this.welcomeNotificationService = welcomeNotificationService;
    this.referralService = referralService;
    this.refreshUserReputation = refreshUserReputation;
    this.generateUsername = generateUsername;
    this.projection = projection;
  }

  async execute({ firebaseUser = {}, idToken }) {
    if (!idToken) {
      throw createStatusError(401, "Missing Firebase identity token");
    }

    const decodedToken = await this.verifyIdentityToken(idToken);
    const providerProfile = ProviderProfile.create(firebaseUser, decodedToken);

    if (!providerProfile.uid) {
      throw createStatusError(400, "Missing Firebase user data");
    }

    const now = new Date();
    const { existingUser, matchedBy } = await this.userRepository.findByAuthIdentity(providerProfile);

    let user;
    let isNewUser = false;
    let syncedFields = [];

    if (existingUser) {
      const isLinkingProviderByEmail = matchedBy === "email" && providerProfile.uid !== existingUser.uid;
      const existingProviders = Array.isArray(existingUser.authProviders) ? existingUser.authProviders : [];
      const isExistingLocalAccount =
        existingUser.authenticationMethod === "local" || existingProviders.includes("local");

      if (isLinkingProviderByEmail && isExistingLocalAccount && decodedToken.email_verified === false) {
        throw createStatusError(403, "Verify your social account email before linking it to this MarketSpase profile.");
      }

      const syncUpdate = buildExistingUserSyncUpdate(existingUser, providerProfile, now);
      syncedFields = syncUpdate.syncedFields;
      user = await this.userRepository.updateById(existingUser._id, syncUpdate.setFields, this.projection);
    } else {
      const username = await this.generateUsername(providerProfile.displayName || "User");
      const newUserDraft = buildNewAuthUserDraft(providerProfile, { username, now });
      syncedFields = buildNewUserSyncedFields(providerProfile);
      user = await this.userRepository.createUser(newUserDraft, this.projection);
      isNewUser = true;
    }

    if (isNewUser) {
      await this.handleNewUser(user, providerProfile);
    } else {
      await this.handleReturningUser(user, providerProfile, syncedFields, matchedBy);
    }

    const reputationSnapshot = await this.refreshUserReputation(user._id);

    return {
      success: true,
      message: isNewUser ? "Account created" : "Signed in successfully",
      user,
      isNewUser,
      syncedFields,
      matchedBy,
      providerProfile: providerProfile.toJSON(),
      reputationSnapshot,
    };
  }

  async handleNewUser(user, providerProfile) {
    if (providerProfile.referralCode) {
      try {
        await this.referralService.processReferral(user._id, providerProfile.referralCode, user.role);
        await this.activityLogService.record(user._id, {
          action: "referred_signup",
          description: `Joined using referral from ${providerProfile.referralCode}`,
          metadata: { referralCode: providerProfile.referralCode },
        });
      } catch (error) {
        console.error("Referral failed:", error);
      }
    }

    await this.welcomeNotificationService.sendNewUserNotifications(user);
    await this.activityLogService.record(user._id, {
      action: "signup",
      description: "New account created",
    });
    console.log(`New user: ${user.username} via ${providerProfile.authenticationMethod}`);
  }

  async handleReturningUser(user, providerProfile, syncedFields, matchedBy) {
    if (syncedFields.length > 0) {
      await this.activityLogService.record(user._id, {
        action: "provider_profile_sync",
        description: "Provider profile fields updated during login",
        metadata: {
          syncedFields,
          matchedBy,
          authenticationMethod: providerProfile.authenticationMethod,
        },
      });
    }

    await this.activityLogService.record(user._id, {
      action: "login",
      description: "User logged in",
      metadata: {
        userDevice: providerProfile.userDevice,
        matchedBy,
        syncedFields,
        authenticationMethod: providerProfile.authenticationMethod,
      },
    });

    console.log(
      `User logged in: ${user.username}${
        syncedFields.length ? ` (synced: ${syncedFields.join(", ")})` : ""
      }`
    );
  }
}
