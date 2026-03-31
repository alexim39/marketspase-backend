export const setupUserDismissalIndexes = (schema) => {
  // Unique index on userId
  schema.index({ userId: 1 }, { unique: true });
  
  // Index on dismissedNotifications for lookups
  schema.index({ dismissedNotifications: 1 });
  
  // Compound index for dismissal queries
  schema.index({ userId: 1, dismissedNotifications: 1 });
  
  // Index for dismissal count queries
  schema.index({ dismissalCount: -1 });
  
  // Index for last dismissal queries
  schema.index({ lastDismissedAt: -1 });
  
  // Index for cleanup queries
  schema.index({ updatedAt: 1 });
};