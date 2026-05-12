import jwt from 'jsonwebtoken';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth as getFirebaseAuth } from 'firebase-admin/auth';
import { UserModel } from '../../apps/user/models/user/index.js';
import { AdminModel } from '../../apps/auth/models/index.js';

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.GCP_PROJECT_ID;

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

const selectSafeUser = (query) => UserModel.findOne(query).select('-password');
const selectSafeAdmin = (query) => AdminModel.findOne(query).select('-password');

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
      user.uid = decoded.uid;
      await user.save();
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

  let user = await UserModel.findById(subjectId).select('-password');
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

export const resolveAccessToken = async (token) => {
  let firebaseError = null;

  try {
    return await verifyFirebaseToken(token);
  } catch (error) {
    firebaseError = error;
  }

  try {
    return await verifyLegacyToken(token);
  } catch (legacyError) {
    if (legacyError.name === 'TokenExpiredError' || firebaseError?.code === 'auth/id-token-expired') {
      const error = new Error('Token expired');
      error.status = 401;
      throw error;
    }

    const message =
      firebaseError?.message === 'User not found'
        ? firebaseError.message
        : legacyError.message === 'User not found'
        ? legacyError.message
        : 'Invalid token';

    const error = new Error(message);
    error.status = message === 'User not found' ? 401 : 401;
    throw error;
  }
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
    return authContext;
  }

  const cookieToken = getCookieToken(req);
  if (cookieToken) {
    const authContext = await verifyLegacyToken(cookieToken);
    attachAuthContext(req, authContext);
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
