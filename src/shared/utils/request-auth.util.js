export const getAuthenticatedUserId = (req) =>
  req.userId || req.user?._id?.toString?.() || null;

export const getAuthenticatedUserUid = (req) =>
  req.auth?.uid || req.user?.uid || null;

export const isAdminRequest = (req) => ['admin', 'super-admin'].includes(req.user?.role);

export const matchesAuthenticatedUserId = (req, candidateUserId) => {
  if (!candidateUserId) return false;
  if (isAdminRequest(req)) return true;
  return String(candidateUserId) === String(getAuthenticatedUserId(req));
};

export const matchesAuthenticatedUid = (req, candidateUid) => {
  if (!candidateUid) return false;
  if (isAdminRequest(req)) return true;
  return String(candidateUid) === String(getAuthenticatedUserUid(req));
};

export const ensureSelfOrAdmin = (req, candidateUserId, res, message = 'You are not authorized to access this resource') => {
  if (matchesAuthenticatedUserId(req, candidateUserId)) {
    return true;
  }

  res.status(403).json({
    success: false,
    message,
  });
  return false;
};

export const ensureUidSelfOrAdmin = (req, candidateUid, res, message = 'You are not authorized to access this resource') => {
  if (matchesAuthenticatedUid(req, candidateUid)) {
    return true;
  }

  res.status(403).json({
    success: false,
    message,
  });
  return false;
};
