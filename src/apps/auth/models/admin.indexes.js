export const setupAdminIndexes = (schema) => {
  // Unique index on email
  schema.index({ email: 1 }, { unique: true });
  
  // Index for role-based queries
  schema.index({ role: 1, isActive: 1, isDeleted: 1 });
  
  // Index for date-based queries
  schema.index({ createdAt: -1 });
  schema.index({ lastLogin: -1 });
  
  // Compound index for active admins
  schema.index({ isActive: 1, isDeleted: 1, createdAt: -1 });
  
  // Index for search queries
  schema.index({ name: 'text', email: 'text' });
  
  // Index for login history queries
  schema.index({ 'loginHistory.timestamp': -1 });
  
  // Index for password reset tokens
  schema.index({ passwordResetToken: 1 }, { 
    sparse: true,
    partialFilterExpression: { passwordResetToken: { $exists: true } }
  });
  
  // Index for refresh tokens
  schema.index({ refreshToken: 1 }, { 
    sparse: true,
    partialFilterExpression: { refreshToken: { $exists: true } }
  });
  
  // Compound index for soft delete queries
  schema.index({ isDeleted: 1, deletedAt: -1 });
  
  // Index for two-factor authentication queries
  schema.index({ twoFactorEnabled: 1, isActive: 1 });
};