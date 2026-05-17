import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth as getFirebaseAuth } from 'firebase-admin/auth';
import { UserModel } from '../../apps/user/models/user/index.js';
import { AdminModel } from '../../apps/auth/models/index.js';

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.GCP_PROJECT_ID;
const AUTH_CACHE_TTL_MS = Math.max(Number.parseInt(process.env.AUTH_CACHE_TTL_MS || '60000', 10) || 60000, 0);
const AUTH_CACHE_MAX_ENTRIES = Math.max(Number.parseInt(process.env.AUTH_CACHE_MAX_ENTRIES || '500', 10) || 500, 50);
const AUTH_HASH_SALT = process.env.CLICK_TRACKING_HASH_SALT || process.env.JWTTOKENSECRET || 'marketspase-auth';
const authCache = new Map();

const hashValue = (value = '') =>
  crypto
    .createHash('sha256')
    .update(`${AUTH_HASH_SALT}:${value}`)
    .digest('hex');

const getClientIp = (req) => {
  const directHeaders = [
    req.headers['cf-connecting-ip'],
    req.headers['x-real-ip'],
  ];

  for (const headerValue of directHeaders) {
    if (typeof headerValue === 'string' && headerValue.trim()) {
      return headerValue.trim();
    }
  }

  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || '';
};

const getDeviceType = (userAgent = '') => {
  const ua = String(userAgent || '').toLowerCase();
  if (/ipad|tablet/.test(ua)) return 'tablet';
  if (/mobile|iphone|android/.test(ua)) return 'mobile';
  if (ua) return 'desktop';
  return 'unknown';
};

const parseServiceAccount = () => {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT_JSON_B64;
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    try {
      return JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    } catch (error) {
      console.error('Failed to parse Firebase service account configuration:', error.message);
      return null;
    }
  }
};

const getFirebaseAdminAuth = () => {
  if (getApps().length > 0) {
    return getFirebaseAuth();
  }

  const serviceAccount = parseServiceAccount();
  const options = {};

  if (serviceAccount) {
    options.credential = cert(serviceAccount);
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    options.credential = applicationDefault();
  }

  if (FIREBASE_PROJECT_ID) {
    options.projectId = FIREBASE_PROJECT_ID;
  }

  initializeApp(options);
  return getFirebaseAuth();
};

const selectSafeUser = (query) => UserModel.findOne(query).select('-password').lean();
const selectSafeAdmin = (query) => AdminModel.findOne(query).select('-password').lean();

const readCachedAuthContext = (token) => {
  if (!AUTH_CACHE_TTL_MS || !token) {
    return null;
  }

  const cached = authCache.get(token);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    authCache.delete(token);
    return null;
  }

  return {
    ...cached.authContext,
    user: cached.authContext.user ? { ...cached.authContext.user } : null,
    decoded: cached.authContext.decoded ? { ...cached.authContext.decoded } : null,
  };
};

const writeCachedAuthContext = (token, authContext) => {
  if (!AUTH_CACHE_TTL_MS || !token || !authContext?.user?._id) {
    return;
  }

  if (authCache.size >= AUTH_CACHE_MAX_ENTRIES) {
    const oldestKey = authCache.keys().next().value;
    if (oldestKey) {
      authCache.delete(oldestKey);
    }
  }

  authCache.set(token, {
    expiresAt: Date.now() + AUTH_CACHE_TTL_MS,
    authContext: {
      ...authContext,
      user: authContext.user ? { ...authContext.user } : null,
      decoded: authContext.decoded ? { ...authContext.decoded } : null,
    },
  });
};

const clearCachedAuthContext = (token) => {
  if (token) {
    authCache.delete(token);
  }
};

export const invalidateAuthCacheForUser = (userId) => {
  if (!userId) {
    return;
  }

  for (const [token, entry] of authCache.entries()) {
    if (String(entry?.authContext?.user?._id || '') === String(userId)) {
      authCache.delete(token);
    }
  }
};

export const extractBearerToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.slice('Bearer '.length).trim();
};

const getCookieToken = (req) => {
  const cookieToken = req.cookies?.jwt;
  return cookieToken ? String(cookieToken).trim() : null;
};

const buildAuthContext = (type, token, decoded, user) => ({
  type,
  token,
  decoded,
  uid: decoded?.uid || user?.uid || null,
  user,
});

const verifyFirebaseToken = async (token) => {
  const decoded = await getFirebaseAdminAuth().verifyIdToken(token);
  let user = await selectSafeUser({ uid: decoded.uid });

  if (!user && decoded.email) {
    user = await selectSafeUser({ email: decoded.email.toLowerCase() });
    if (user && user.uid !== decoded.uid) {
      await UserModel.updateOne(
        { _id: user._id },
        { $set: { uid: decoded.uid } }
      );
      user.uid = decoded.uid;
    }
  }

  if (!user) {
    const error = new Error('User not found');
    error.status = 401;
    throw error;
  }

  return buildAuthContext('firebase', token, decoded, user);
};

export const verifyFirebaseIdentityToken = async (token) => getFirebaseAdminAuth().verifyIdToken(token);

const verifyLegacyToken = async (token) => {
  if (!process.env.JWTTOKENSECRET) {
    const error = new Error('Legacy authentication is not configured');
    error.status = 500;
    throw error;
  }

  const decoded = jwt.verify(token, process.env.JWTTOKENSECRET);
  const subjectId = decoded.id || decoded._id;

  let user = await UserModel.findById(subjectId).select('-password').lean();
  let authType = 'legacy';

  if (!user) {
    user = await selectSafeAdmin({ _id: subjectId, isDeleted: { $ne: true } });
    authType = 'admin';
  }

  if (!user) {
    const error = new Error('User not found');
    error.status = 401;
    throw error;
  }

  return buildAuthContext(authType, token, decoded, user);
};

const decodeTokenPayload = (token) => {
  try {
    const decoded = jwt.decode(token);
    return decoded && typeof decoded === 'object' ? decoded : null;
  } catch {
    return null;
  }
};

const inferTokenStrategy = (token) => {
  const decoded = decodeTokenPayload(token);

  if (!decoded) {
    return process.env.JWTTOKENSECRET ? 'legacy-first' : 'firebase-first';
  }

  if (decoded.id || decoded._id) {
    return 'legacy-first';
  }

  if (
    typeof decoded.iss === 'string' &&
    decoded.iss.startsWith('https://securetoken.google.com/')
  ) {
    return 'firebase-first';
  }

  if (decoded.firebase || decoded.user_id) {
    return 'firebase-first';
  }

  return process.env.JWTTOKENSECRET ? 'legacy-first' : 'firebase-first';
};

const ensureUserAccessAllowed = async (authContext) => {
  const isAdminContext =
    authContext?.type === 'admin' ||
    ['admin', 'super-admin'].includes(authContext?.user?.role);

  if (isAdminContext || !authContext?.user?._id) {
    return authContext;
  }

  const suspendedUntilValue = authContext.user?.fraudProfile?.suspendedUntil;
  const suspendedUntil = suspendedUntilValue ? new Date(suspendedUntilValue) : null;
  const now = new Date();

  if (authContext.user.isActive === false) {
    if (suspendedUntil && suspendedUntil <= now) {
      await UserModel.updateOne(
        { _id: authContext.user._id },
        {
          $set: {
            isActive: true,
            'fraudProfile.suspendedUntil': null,
            'fraudProfile.suspensionReason': '',
            'fraudProfile.riskLevel': authContext.user?.fraudProfile?.activeCaseCount > 0 ? 'medium' : 'low',
          },
        }
      );

      authContext.user.isActive = true;
      authContext.user.fraudProfile = {
        ...(authContext.user.fraudProfile || {}),
        suspendedUntil: null,
        suspensionReason: '',
        riskLevel: authContext.user?.fraudProfile?.activeCaseCount > 0 ? 'medium' : 'low',
      };

      return authContext;
    }

    const error = new Error(
      suspendedUntil && suspendedUntil > now
        ? `Your account is suspended until ${suspendedUntil.toISOString()}.`
        : 'Your account is inactive. Please contact support.'
    );
    error.status = 403;
    throw error;
  }

  return authContext;
};

const recordAuthenticatedFingerprint = (req, authContext) => {
  const isAdminContext =
    authContext?.type === 'admin' ||
    ['admin', 'super-admin'].includes(authContext?.user?.role);

  if (isAdminContext || !authContext?.user?._id) {
    return;
  }

  const userAgent = req.headers['user-agent'] || '';
  const ipHash = hashValue(getClientIp(req));
  const userAgentHash = hashValue(userAgent);
  const deviceType = getDeviceType(userAgent);
  const lastRecordedAt = authContext.user?.securityProfile?.lastAuthAt
    ? new Date(authContext.user.securityProfile.lastAuthAt)
    : null;
  const shouldUpdate =
    authContext.user?.securityProfile?.lastAuthIpHash !== ipHash ||
    authContext.user?.securityProfile?.lastAuthUserAgentHash !== userAgentHash ||
    authContext.user?.securityProfile?.lastAuthDeviceType !== deviceType ||
    !lastRecordedAt ||
    (Date.now() - lastRecordedAt.getTime()) > (5 * 60 * 1000);

  if (!shouldUpdate) {
    return;
  }

  authContext.user.securityProfile = {
    ...(authContext.user.securityProfile || {}),
    lastAuthIpHash: ipHash,
    lastAuthUserAgentHash: userAgentHash,
    lastAuthDeviceType: deviceType,
    lastAuthAt: new Date(),
  };

  setImmediate(() => {
    UserModel.updateOne(
      { _id: authContext.user._id },
      {
        $set: {
          lastSeenAt: new Date(),
          'securityProfile.lastAuthIpHash': ipHash,
          'securityProfile.lastAuthUserAgentHash': userAgentHash,
          'securityProfile.lastAuthDeviceType': deviceType,
          'securityProfile.lastAuthAt': new Date(),
        },
      }
    ).catch((error) => {
      console.warn('Failed to record user security profile:', error.message);
    });
  });
};

export const resolveAccessToken = async (token) => {
  const cachedAuthContext = readCachedAuthContext(token);
  if (cachedAuthContext) {
    return ensureUserAccessAllowed(cachedAuthContext);
  }

  const strategy = inferTokenStrategy(token);
  const verifiers =
    strategy === 'firebase-first'
      ? [verifyFirebaseToken, verifyLegacyToken]
      : [verifyLegacyToken, verifyFirebaseToken];

  let firstError = null;

  for (const verifier of verifiers) {
    try {
      const authContext = await ensureUserAccessAllowed(await verifier(token));
      writeCachedAuthContext(token, authContext);
      return authContext;
    } catch (error) {
      if (!firstError) {
        firstError = error;
      }

      const isExpired =
        error?.name === 'TokenExpiredError' ||
        error?.code === 'auth/id-token-expired';

      if (isExpired) {
        const expiredError = new Error('Token expired');
        expiredError.status = 401;
        throw expiredError;
      }
    }
  }

  clearCachedAuthContext(token);

  const error = new Error(
    firstError?.message === 'User not found' ? 'User not found' : 'Invalid token'
  );
  error.status = 401;
  throw error;
};

const attachAuthContext = (req, authContext) => {
  req.auth = {
    type: authContext.type,
    uid: authContext.uid,
    decoded: authContext.decoded,
  };
  req.user = authContext.user;
  req.userId = authContext.user._id.toString();
};

export const resolveRequestAuth = async (req) => {
  const bearerToken = extractBearerToken(req);
  if (bearerToken) {
    const authContext = await resolveAccessToken(bearerToken);
    attachAuthContext(req, authContext);
    recordAuthenticatedFingerprint(req, authContext);
    writeCachedAuthContext(bearerToken, authContext);
    return authContext;
  }

  const cookieToken = getCookieToken(req);
  if (cookieToken) {
    const authContext = await ensureUserAccessAllowed(
      readCachedAuthContext(cookieToken) || await verifyLegacyToken(cookieToken)
    );
    writeCachedAuthContext(cookieToken, authContext);
    attachAuthContext(req, authContext);
    recordAuthenticatedFingerprint(req, authContext);
    writeCachedAuthContext(cookieToken, authContext);
    return authContext;
  }

  const error = new Error('Access denied. No token provided.');
  error.status = 401;
  throw error;
};

export const authenticate = async (req, res, next) => {
  try {
    await resolveRequestAuth(req);
    next();
  } catch (error) {
    return res.status(error.status || 401).json({
      success: false,
      message: error.message || 'Invalid token',
    });
  }
};

export const optionalAuthenticate = async (req, _res, next) => {
  const token = extractBearerToken(req) || getCookieToken(req);
  if (!token) {
    next();
    return;
  }

  try {
    await resolveRequestAuth(req);
  } catch (error) {
    console.warn('Optional authentication failed:', error.message);
  }

  next();
};
