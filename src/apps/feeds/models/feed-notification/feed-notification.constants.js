// Notification Types
export const NOTIFICATION_TYPE = {
  LIKE: 'like',
  COMMENT: 'comment',
  REPLY: 'reply',
  MENTION: 'mention',
  SHARE: 'share',
  SAVE: 'save',
  FEATURED: 'featured',
  TRENDING: 'trending',
  MILESTONE: 'milestone'
};

export const NOTIFICATION_TYPE_ARRAY = Object.values(NOTIFICATION_TYPE);

// Notification Priorities (for future use)
export const NOTIFICATION_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high'
};

// Notification Channels (for future use)
export const NOTIFICATION_CHANNEL = {
  IN_APP: 'in_app',
  EMAIL: 'email',
  PUSH: 'push'
};

// Default Values
export const DEFAULTS = {
  IS_READ: false,
  IS_CLICKED: false,
  METADATA: {},
  TTL_DAYS: 30 // Auto-delete after 30 days
};

// TTL Configuration
export const TTL_CONFIG = {
  EXPIRE_AFTER_SECONDS: 30 * 24 * 60 * 60 // 30 days in seconds
};

// Message Templates
export const MESSAGE_TEMPLATES = {
  [NOTIFICATION_TYPE.LIKE]: (actorName) => `${actorName} liked your post`,
  [NOTIFICATION_TYPE.COMMENT]: (actorName) => `${actorName} commented on your post`,
  [NOTIFICATION_TYPE.REPLY]: (actorName) => `${actorName} replied to your comment`,
  [NOTIFICATION_TYPE.MENTION]: (actorName) => `${actorName} mentioned you in a post`,
  [NOTIFICATION_TYPE.SHARE]: (actorName) => `${actorName} shared your post`,
  [NOTIFICATION_TYPE.SAVE]: (actorName) => `${actorName} saved your post`,
  [NOTIFICATION_TYPE.FEATURED]: () => 'Your post has been featured!',
  [NOTIFICATION_TYPE.TRENDING]: () => 'Your post is trending!',
  [NOTIFICATION_TYPE.MILESTONE]: (milestone) => `You reached a milestone: ${milestone || 'Congratulations!'}`
};

// Batch Operation Limits
export const BATCH_LIMITS = {
  MAX_MARK_READ: 100,
  MAX_DELETE: 1000
};

// Error Messages
export const ERROR_MESSAGES = {
  NOTIFICATION_NOT_FOUND: 'Notification not found',
  RECIPIENT_REQUIRED: 'Recipient is required',
  TYPE_REQUIRED: 'Notification type is required',
  ACTOR_REQUIRED: 'Actor is required',
  MESSAGE_REQUIRED: 'Message is required',
  INVALID_TYPE: 'Invalid notification type',
  UNAUTHORIZED: 'You are not authorized to access this notification',
  BATCH_SIZE_EXCEEDED: (max) => `Batch size cannot exceed ${max}`
};

// Success Messages
export const SUCCESS_MESSAGES = {
  NOTIFICATION_CREATED: 'Notification created successfully',
  NOTIFICATIONS_MARKED_READ: 'Notifications marked as read',
  NOTIFICATIONS_DELETED: 'Notifications deleted',
  ALL_CLEARED: 'All notifications cleared'
};

// Activity Actions (for logging)
export const ACTIVITY_ACTIONS = {
  NOTIFICATION_CREATED: 'notification_created',
  NOTIFICATION_READ: 'notification_read',
  NOTIFICATION_CLICKED: 'notification_clicked',
  NOTIFICATIONS_CLEARED: 'notifications_cleared',
  NOTIFICATION_DELETED: 'notification_deleted'
};