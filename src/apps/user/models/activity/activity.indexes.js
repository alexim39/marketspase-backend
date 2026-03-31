export const setupActivityIndexes = (schema) => {
  // Single field indexes
  schema.index({ action: 1 });
  schema.index({ resourceType: 1 });
  schema.index({ resourceId: 1 });
  schema.index({ severity: 1 });
  schema.index({ timestamp: -1 });
  
  // Compound indexes for common queries
  schema.index({ action: 1, timestamp: -1 });
  schema.index({ resourceType: 1, resourceId: 1, timestamp: -1 });
  schema.index({ severity: 1, timestamp: -1 });
  
  // Index for user-based queries (if userId is added)
  // schema.index({ userId: 1, timestamp: -1 });
  // schema.index({ userId: 1, action: 1, timestamp: -1 });
  
  // Index for date range queries
  schema.index({ timestamp: 1, action: 1 });
  
  // TTL index for automatic cleanup (optional)
  // schema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }); // 90 days
  
  // Text index for searching descriptions
  schema.index({ description: 'text' });
  
  // Compound index for resource + action queries
  schema.index({ resourceType: 1, resourceId: 1, action: 1, timestamp: -1 });
};