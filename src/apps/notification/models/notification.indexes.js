export const setupNotificationIndexes = (schema) => {
  // Basic indexes
  schema.index({ recipient: 1, status: 1 });
  schema.index({ recipient: 1, createdAt: -1 });
  schema.index({ type: 1 });
  
  // TTL index - auto-delete expired notifications
  schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  
  // Compound indexes for common queries
  schema.index({ recipient: 1, type: 1, status: 1 });
  schema.index({ recipient: 1, priority: -1, createdAt: -1 });
  
  // Index for sent date queries
  schema.index({ sentAt: -1 });
  
  // Index for read date queries (cleanup)
  schema.index({ readAt: 1 }, { sparse: true });
  
  // Index for unread queries
  schema.index({ 
    recipient: 1, 
    status: 1, 
    expiresAt: 1 
  });
  
  // Index for reminder queries
  schema.index({ 
    type: 1, 
    status: 1, 
    'data.reminderTime': 1 
  });
  
  // Index for data fields
  schema.index({ 'data.campaignId': 1 });
  schema.index({ 'data.promotionId': 1 });
  
  // Compound index for priority sorting
  schema.index({ 
    recipient: 1, 
    priority: -1, 
    status: 1, 
    createdAt: -1 
  });
};