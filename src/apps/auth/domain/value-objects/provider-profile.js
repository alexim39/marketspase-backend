const DEFAULT_AUTH_METHOD = "local";
const ALLOWED_AUTH_METHODS = new Set(["local", "google.com", "facebook.com", "twitter.com"]);

const normalizeString = (value) => {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue || null;
};

const normalizeEmail = (value) => {
  const normalizedValue = normalizeString(value);
  return normalizedValue ? normalizedValue.toLowerCase() : null;
};

const normalizeProviderProfilePayload = (providerProfile = null) => {
  if (!providerProfile || typeof providerProfile !== "object" || Array.isArray(providerProfile)) {
    return {
      providerId: null,
      displayName: null,
      email: null,
      photoURL: null,
    };
  }

  return {
    providerId: normalizeString(providerProfile.providerId),
    displayName: normalizeString(providerProfile.displayName),
    email: normalizeEmail(providerProfile.email),
    photoURL: normalizeString(providerProfile.photoURL),
  };
};

const normalizeProviderData = (providerData = []) => {
  if (!Array.isArray(providerData)) {
    return [];
  }

  return providerData
    .map((provider) => ({
      providerId: normalizeString(provider?.providerId),
      uid: normalizeString(provider?.uid),
      displayName: normalizeString(provider?.displayName),
      email: normalizeEmail(provider?.email),
      photoURL: normalizeString(provider?.photoURL),
    }))
    .filter((provider) => provider.providerId);
};

const resolveAuthenticationMethod = (
  firebaseUser = {},
  decodedToken = {},
  normalizedProviderData = [],
  normalizedProviderProfile = {}
) => {
  const providerCandidate =
    normalizedProviderProfile.providerId ||
    normalizedProviderData[0]?.providerId ||
    normalizeString(firebaseUser?.providerId) ||
    normalizeString(decodedToken?.firebase?.sign_in_provider) ||
    DEFAULT_AUTH_METHOD;

  const normalizedCandidate = providerCandidate === "password" ? DEFAULT_AUTH_METHOD : providerCandidate;
  return ALLOWED_AUTH_METHODS.has(normalizedCandidate) ? normalizedCandidate : DEFAULT_AUTH_METHOD;
};

export class ProviderProfile {
  constructor(props) {
    this.uid = props.uid;
    this.displayName = props.displayName;
    this.email = props.email;
    this.avatar = props.avatar;
    this.authenticationMethod = props.authenticationMethod;
    this.referralCode = props.referralCode;
    this.userDevice = props.userDevice;
    this.providerData = props.providerData;
  }

  static create(firebaseUser = {}, decodedToken = {}) {
    const providerData = normalizeProviderData(firebaseUser?.providerData);
    const primaryProviderProfile = providerData[0] || {};
    const explicitProviderProfile = normalizeProviderProfilePayload(
      firebaseUser?.providerProfile || firebaseUser?.oauthProfile
    );

    return new ProviderProfile({
      uid: normalizeString(firebaseUser?.uid) || normalizeString(decodedToken?.uid),
      displayName:
        explicitProviderProfile.displayName ||
        normalizeString(firebaseUser?.displayName) ||
        normalizeString(decodedToken?.name) ||
        primaryProviderProfile.displayName,
      email:
        explicitProviderProfile.email ||
        normalizeEmail(firebaseUser?.email) ||
        normalizeEmail(decodedToken?.email) ||
        primaryProviderProfile.email,
      avatar:
        explicitProviderProfile.photoURL ||
        normalizeString(firebaseUser?.photoURL) ||
        normalizeString(decodedToken?.picture) ||
        primaryProviderProfile.photoURL,
      authenticationMethod: resolveAuthenticationMethod(
        firebaseUser,
        decodedToken,
        providerData,
        explicitProviderProfile
      ),
      referralCode: normalizeString(firebaseUser?.referralCode),
      userDevice: normalizeString(firebaseUser?.userDevice),
      providerData,
    });
  }

  toJSON() {
    return {
      uid: this.uid,
      displayName: this.displayName,
      email: this.email,
      avatar: this.avatar,
      authenticationMethod: this.authenticationMethod,
      referralCode: this.referralCode,
      userDevice: this.userDevice,
      providerData: this.providerData,
    };
  }
}
