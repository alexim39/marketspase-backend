export const formatAdminUserExportRecord = (user = {}) => ({
  _id: user._id,
  uid: user.uid,
  username: user.username,
  displayName: user.displayName,
  email: user.email,
  role: user.role,
  isActive: user.isActive,
  isVerified: user.isVerified,
  isDeleted: user.isDeleted,
  balance: user.role === 'marketer'
    ? user.wallets?.marketer?.balance || 0
    : user.wallets?.promoter?.balance || 0,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});
