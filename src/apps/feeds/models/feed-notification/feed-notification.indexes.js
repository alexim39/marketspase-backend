import { TTL_CONFIG } from "./feed-notification.constants.js";

export const setupFeedNotificationIndexes = (schema) => {
  // TTL index - auto-delete after 30 days
  schema.index({ createdAt: 1 }, { expireAfterSeconds: TTL_CONFIG.EXPIRE_AFTER_SECONDS });

  // Index for user notifications
  schema.index({ recipient: 1, isRead: 1, createdAt: -1 });
  
  // Index for unread queries
  schema.index({ recipient: 1, isRead: 1 });
  
  // Index for type-based queries
  schema.index({ type: 1, createdAt: -1 });
  
  // Index for actor-based queries
  schema.index({ actor: 1, createdAt: -1 });
  
  // Index for post-based queries
  schema.index({ post: 1, type: 1 });
  
  // Index for group-based queries
  schema.index({ groupId: 1, createdAt: -1 });
  
  // Compound index for filtering
  schema.index({ 
    recipient: 1, 
    type: 1, 
    isRead: 1, 
    createdAt: -1 
  });
  
  // Index for read at queries (cleanup)
  schema.index({ readAt: 1 }, { sparse: true });
  
  // Index for clicked at queries
  schema.index({ clickedAt: 1 }, { sparse: true });
  
  // Index for priority sorting
  schema.index({ priority: -1, createdAt: -1 });
  
  // Index for metadata queries (if needed)
  schema.index({ 'metadata.important': 1 });
};