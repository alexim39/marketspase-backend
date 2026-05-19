import { ProviderProfile } from "../domain/value-objects/provider-profile.js";
import {
  buildExistingUserSyncUpdate,
  buildNewAuthUserDraft,
  buildNewUserSyncedFields,
} from "../domain/services/provider-profile-reconciliation.service.js";
import { MongooseAuthUserRepository } from "../infrastructure/repositories/mongoose-auth-user.repository.js";
import { generateUniqueUsername } from "./username-generator.js";

const authUserRepository = new MongooseAuthUserRepository();

export const normalizeProviderProfile = (firebaseUser = {}, decodedToken = {}) =>
  ProviderProfile.create(firebaseUser, decodedToken).toJSON();

export const syncUserFromProviderProfile = async (firebaseUser = {}, decodedToken = {}, options = {}) => {
  const providerProfile = ProviderProfile.create(firebaseUser, decodedToken);

  if (!providerProfile.uid) {
    const error = new Error("Missing Firebase user data");
    error.statusCode = 400;
    throw error;
  }

  const now = options.now || new Date();
  const { existingUser, matchedBy } = await authUserRepository.findByAuthIdentity(providerProfile);

  if (existingUser) {
    const syncUpdate = buildExistingUserSyncUpdate(existingUser, providerProfile, now);
    const user = await authUserRepository.updateById(existingUser._id, syncUpdate.setFields, options.projection);

    return {
      user,
      isNewUser: false,
      matchedBy,
      syncedFields: syncUpdate.syncedFields,
      providerProfile: providerProfile.toJSON(),
    };
  }

  const username = await generateUniqueUsername(providerProfile.displayName || "User");
  const newUserDraft = buildNewAuthUserDraft(providerProfile, { username, now });
  const user = await authUserRepository.createUser(newUserDraft, options.projection);

  return {
    user,
    isNewUser: true,
    matchedBy: "new",
    syncedFields: buildNewUserSyncedFields(providerProfile),
    providerProfile: providerProfile.toJSON(),
  };
};
