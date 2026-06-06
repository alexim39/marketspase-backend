const DEFAULT_DISPLAY_NAME = "User";
const DEFAULT_AVATAR = "img/avatar.png";
const DEFAULT_AUTH_METHOD = "local";

export const buildExistingUserSyncUpdate = (existingUser, providerProfile, now = new Date()) => {
  const setFields = {
    lastSeenAt: now,
  };
  const syncedFields = [];
  const existingProviders = Array.isArray(existingUser.authProviders)
    ? existingUser.authProviders.filter(Boolean)
    : existingUser.authenticationMethod
      ? [existingUser.authenticationMethod]
      : [];

  if (providerProfile.uid && providerProfile.uid !== existingUser.uid) {
    setFields.uid = providerProfile.uid;
    syncedFields.push("uid");
  }

  if (providerProfile.displayName && providerProfile.displayName !== existingUser.displayName) {
    setFields.displayName = providerProfile.displayName;
    syncedFields.push("displayName");
  }

  if (providerProfile.email && providerProfile.email !== existingUser.email) {
    setFields.email = providerProfile.email;
    syncedFields.push("email");
  }

  if (providerProfile.avatar && providerProfile.avatar !== existingUser.avatar) {
    setFields.avatar = providerProfile.avatar;
    syncedFields.push("avatar");
  }

  if (
    providerProfile.authenticationMethod &&
    providerProfile.authenticationMethod !== existingUser.authenticationMethod
  ) {
    setFields.authenticationMethod = providerProfile.authenticationMethod;
    syncedFields.push("authenticationMethod");
  }

  if (
    providerProfile.authenticationMethod &&
    !existingProviders.includes(providerProfile.authenticationMethod)
  ) {
    setFields.authProviders = [...existingProviders, providerProfile.authenticationMethod];
    syncedFields.push("authProviders");
  }

  if (providerProfile.userDevice && providerProfile.userDevice !== existingUser.userDevice) {
    setFields.userDevice = providerProfile.userDevice;
    syncedFields.push("userDevice");
  }

  return {
    setFields,
    syncedFields,
  };
};

export const buildNewAuthUserDraft = (providerProfile, { username, now = new Date() } = {}) => ({
  uid: providerProfile.uid,
  username,
  displayName: providerProfile.displayName || DEFAULT_DISPLAY_NAME,
  email: providerProfile.email || undefined,
  avatar: providerProfile.avatar || DEFAULT_AVATAR,
  authenticationMethod: providerProfile.authenticationMethod || DEFAULT_AUTH_METHOD,
  authProviders: [providerProfile.authenticationMethod || DEFAULT_AUTH_METHOD],
  userDevice: providerProfile.userDevice || undefined,
  lastSeenAt: now,
});

export const buildNewUserSyncedFields = (providerProfile) => [
  "uid",
  "displayName",
  "authenticationMethod",
  ...(providerProfile.email ? ["email"] : []),
  ...(providerProfile.avatar ? ["avatar"] : []),
  ...(providerProfile.userDevice ? ["userDevice"] : []),
];
