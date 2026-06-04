export const isAdminReferralViewer = (role) => ['admin', 'super-admin'].includes(role);

export const canViewReferralProfile = ({
  requestUserId = null,
  requestUserRole = null,
  targetUserId = null,
} = {}) => {
  if (isAdminReferralViewer(requestUserRole)) {
    return true;
  }

  if (!requestUserId || !targetUserId) {
    return false;
  }

  return String(requestUserId) === String(targetUserId);
};
