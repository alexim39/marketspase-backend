export const setupUserIndexes = (schema) => {
  // Basic indexes
  schema.index({ uid: 1 });
  schema.index({ username: 1 });
  schema.index({ email: 1 });
  schema.index({ role: 1 });
  schema.index({ isActive: 1, isDeleted: 1 });
  schema.index({ lastSeenAt: -1 });
  
  // Partial index for non-null phones (unique)
  schema.index(
    { 'personalInfo.phone': 1 },
    {
      unique: true,
      partialFilterExpression: { 'personalInfo.phone': { $exists: true, $ne: null } }
    }
  );
  
  // Transaction reference indexes
  schema.index({ 'wallets.promoter.transactions.reference': 1 }, { unique: true, sparse: true });
  schema.index({ 'wallets.marketer.transactions.reference': 1 }, { unique: true, sparse: true });
  
  // Activity log indexes
  schema.index({ 'activityLog.action': 1, 'activityLog.timestamp': -1 });
  schema.index({ 'activityLog.resourceType': 1, 'activityLog.resourceId': 1 });
  
  // Notification indexes
  schema.index({ 'notificationStats.muteUntil': 1 });
  schema.index({ 'deviceTokens.token': 1 });
  
  // Referral indexes
  schema.index({ 'referralInfo.referralCode': 1 });
  schema.index({ 'referralInfo.referredBy': 1 });
  
  // Compound indexes for common queries
  schema.index({ role: 1, isActive: 1, createdAt: -1 });
  schema.index({ isVerified: 1, isActive: 1 });
  schema.index({ rating: -1, ratingCount: -1 });
  schema.index({ role: 1, 'personalInfo.address.country': 1, isDeleted: 1 });
  schema.index({ role: 1, 'personalInfo.address.state': 1, isDeleted: 1 });
  schema.index({ role: 1, 'personalInfo.gender': 1, isDeleted: 1 });
  schema.index({ 'personalInfo.dob': 1 });
  schema.index({ 'fraudProfile.suspendedUntil': 1, isActive: 1 });
  schema.index({ 'fraudProfile.riskLevel': 1, role: 1, isDeleted: 1 });
  schema.index({ 'securityProfile.lastAuthIpHash': 1, role: 1, isDeleted: 1 });
  schema.index({ authProviders: 1, isDeleted: 1 });
  schema.index(
    { 'localAuth.verificationCodeExpiresAt': 1 },
    {
      partialFilterExpression: {
        'localAuth.verificationCodeExpiresAt': { $exists: true },
      },
    }
  );
  schema.index(
    { 'localAuth.resetCodeExpiresAt': 1 },
    {
      partialFilterExpression: {
        'localAuth.resetCodeExpiresAt': { $exists: true },
      },
    }
  );
};
