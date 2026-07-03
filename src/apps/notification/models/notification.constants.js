// Notification Types
export const NOTIFICATION_TYPE = {
  // Promotion related
  PROMOTION_PENDING: 'promotion_pending',
  PROMOTION_ASSIGNED: 'promotion_assigned',
  PROMOTION_SUBMITTED: 'promotion_submitted',
  PROMOTION_VALIDATED: 'promotion_validated',
  PROMOTION_REJECTED: 'promotion_rejected',
  
  // Payment related
  PAYMENT_PROCESSED: 'payment_processed',
  PAYOUT_READY: 'payout_ready',
  REFUND_PROCESSED: 'refund_processed',
  
  // Campaign related
  CAMPAIGN_APPROVED: 'campaign_approved',
  CAMPAIGN_REJECTED: 'campaign_rejected',
  CAMPAIGN_COMPLETED: 'campaign_completed',
  COLLABORATION_MESSAGE: 'collaboration_message',
  REVIEW_RECEIVED: 'review_received',
  REVIEW_FLAGGED: 'review_flagged',
  
  // User related
  LOW_BALANCE: 'low_balance',
  BIRTHDAY_GREETING: 'birthday_greeting',
  BADGE_UNLOCKED: 'badge_unlocked',
  LEVEL_UP: 'level_up',
  GAMIFICATION_MILESTONE_UNLOCKED: 'gamification_milestone_unlocked',
  FORUM_ACTIVITY: 'forum_activity',
  
  // Reminders
  REMINDER: 'reminder',
  SUBMISSION_REMINDER: 'submission_reminder',
  DEADLINE_REMINDER: 'deadline_reminder',
  
  // System
  SYSTEM_ANNOUNCEMENT: 'system_announcement',
  SYSTEM_REPORT: 'system_report',
  WEEKLY_SUMMARY: 'weekly_summary',

  // Campaign health
  CAMPAIGN_AUTO_PAUSED: 'campaign_auto_paused',
  CAMPAIGN_AUTO_EXHAUSTED: 'campaign_auto_exhausted',
  CAMPAIGN_LOW_BUDGET: 'campaign_low_budget',
  CAMPAIGN_FRAUD_FLAGGED: 'campaign_fraud_flagged',

  // AI / Smart features
  SMART_INVITE: 'smart_invite',
  CAMPAIGN_COACH: 'campaign_coach',

  // Storefront / Cart
  CART_ABANDONED: 'cart_abandoned',
  SERVICE_INQUIRY: 'service_inquiry',
};

export const NOTIFICATION_TYPE_ARRAY = Object.values(NOTIFICATION_TYPE);

// Notification Priorities
export const NOTIFICATION_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high'
};

export const NOTIFICATION_PRIORITY_ARRAY = Object.values(NOTIFICATION_PRIORITY);

// Notification Status
export const NOTIFICATION_STATUS = {
  UNREAD: 'unread',
  READ: 'read',
  DISMISSED: 'dismissed'
};

export const NOTIFICATION_STATUS_ARRAY = Object.values(NOTIFICATION_STATUS);

// Default Values
export const DEFAULTS = {
  PRIORITY: NOTIFICATION_PRIORITY.MEDIUM,
  STATUS: NOTIFICATION_STATUS.UNREAD,
  EXPIRY_DAYS: 30, // Notifications expire after 30 days
  CLEANUP_DAYS: 7 // Clean up read notifications older than 7 days
};

// Error Messages
export const ERROR_MESSAGES = {
  RECIPIENT_REQUIRED: 'Recipient is required',
  TYPE_REQUIRED: 'Notification type is required',
  TITLE_REQUIRED: 'Title is required',
  MESSAGE_REQUIRED: 'Message is required',
  NOTIFICATION_NOT_FOUND: 'Notification not found',
  UNAUTHORIZED_ACCESS: 'You are not authorized to access this notification',
  INVALID_TYPE: 'Invalid notification type',
  INVALID_STATUS: 'Invalid notification status'
};

// Success Messages
export const SUCCESS_MESSAGES = {
  NOTIFICATION_CREATED: 'Notification created successfully',
  NOTIFICATION_UPDATED: 'Notification updated successfully',
  NOTIFICATION_DELETED: 'Notification deleted successfully',
  NOTIFICATIONS_MARKED_READ: 'Notifications marked as read',
  NOTIFICATIONS_CLEANED_UP: 'Old notifications cleaned up successfully'
};

// Notification Titles (templates)
export const NOTIFICATION_TITLES = {
  [NOTIFICATION_TYPE.PROMOTION_PENDING]: 'Promotion Pending Approval',
  [NOTIFICATION_TYPE.PROMOTION_ASSIGNED]: 'New Promotion Assigned',
  [NOTIFICATION_TYPE.PROMOTION_SUBMITTED]: 'Promotion Submitted',
  [NOTIFICATION_TYPE.PROMOTION_VALIDATED]: 'Promotion Validated',
  [NOTIFICATION_TYPE.PROMOTION_REJECTED]: 'Promotion Rejected',
  [NOTIFICATION_TYPE.PAYMENT_PROCESSED]: 'Payment Processed',
  [NOTIFICATION_TYPE.PAYOUT_READY]: 'Payout Ready',
  [NOTIFICATION_TYPE.REFUND_PROCESSED]: 'Refund Processed',
  [NOTIFICATION_TYPE.CAMPAIGN_APPROVED]: 'Campaign Approved',
  [NOTIFICATION_TYPE.CAMPAIGN_REJECTED]: 'Campaign Rejected',
  [NOTIFICATION_TYPE.CAMPAIGN_COMPLETED]: 'Campaign Completed',
  [NOTIFICATION_TYPE.COLLABORATION_MESSAGE]: 'New Collaboration Message',
  [NOTIFICATION_TYPE.REVIEW_RECEIVED]: 'New Collaboration Review',
  [NOTIFICATION_TYPE.REVIEW_FLAGGED]: 'Review Flagged For Moderation',
  [NOTIFICATION_TYPE.LOW_BALANCE]: 'Low Balance Alert',
  [NOTIFICATION_TYPE.BIRTHDAY_GREETING]: 'Happy Birthday!',
  [NOTIFICATION_TYPE.BADGE_UNLOCKED]: 'New Badge Unlocked',
  [NOTIFICATION_TYPE.LEVEL_UP]: 'Level Up',
  [NOTIFICATION_TYPE.GAMIFICATION_MILESTONE_UNLOCKED]: 'New Milestone Unlocked',
  [NOTIFICATION_TYPE.REMINDER]: 'Reminder',
  [NOTIFICATION_TYPE.SUBMISSION_REMINDER]: 'Submission Reminder',
  [NOTIFICATION_TYPE.DEADLINE_REMINDER]: 'Deadline Reminder',
  [NOTIFICATION_TYPE.SYSTEM_ANNOUNCEMENT]: 'System Announcement',
  [NOTIFICATION_TYPE.SYSTEM_REPORT]: 'System Report',
  [NOTIFICATION_TYPE.WEEKLY_SUMMARY]: 'Weekly Summary',
  [NOTIFICATION_TYPE.CAMPAIGN_AUTO_PAUSED]: 'Campaign Auto-Paused',
  [NOTIFICATION_TYPE.CAMPAIGN_AUTO_EXHAUSTED]: 'Campaign Budget Exhausted',
  [NOTIFICATION_TYPE.CAMPAIGN_LOW_BUDGET]: 'Campaign Budget Low',
  [NOTIFICATION_TYPE.CAMPAIGN_FRAUD_FLAGGED]: 'Suspicious Activity Detected',
  [NOTIFICATION_TYPE.SMART_INVITE]: 'New Campaign Match',
  [NOTIFICATION_TYPE.CAMPAIGN_COACH]: 'Campaign Performance Insight',
  [NOTIFICATION_TYPE.CART_ABANDONED]: 'Cart Reminder',
  [NOTIFICATION_TYPE.SERVICE_INQUIRY]: 'New Service Inquiry',
};

// Action URLs (templates)
export const ACTION_URLS = {
  [NOTIFICATION_TYPE.PROMOTION_PENDING]: (id) => `/admin/promotions/${id}`,
  [NOTIFICATION_TYPE.PROMOTION_ASSIGNED]: (id) => `/promoter/promotions/${id}`,
  [NOTIFICATION_TYPE.PROMOTION_SUBMITTED]: (id) => `/marketer/promotions/${id}`,
  [NOTIFICATION_TYPE.PROMOTION_VALIDATED]: (id) => `/promoter/promotions/${id}`,
  [NOTIFICATION_TYPE.PROMOTION_REJECTED]: (id) => `/promoter/promotions/${id}`,
  [NOTIFICATION_TYPE.PAYMENT_PROCESSED]: () => '/wallet/transactions',
  [NOTIFICATION_TYPE.PAYOUT_READY]: () => '/wallet/withdraw',
  [NOTIFICATION_TYPE.CAMPAIGN_APPROVED]: (id) => `/marketer/campaigns/${id}`,
  [NOTIFICATION_TYPE.CAMPAIGN_REJECTED]: (id) => `/marketer/campaigns/${id}`,
  [NOTIFICATION_TYPE.CAMPAIGN_COMPLETED]: (id) => `/marketer/campaigns/${id}`,
  [NOTIFICATION_TYPE.COLLABORATION_MESSAGE]: () => `/dashboard/campaigns/collaboration`,
  [NOTIFICATION_TYPE.REVIEW_RECEIVED]: () => `/dashboard/profile`,
  [NOTIFICATION_TYPE.REVIEW_FLAGGED]: () => `/dashboard/users/reviews`,
  [NOTIFICATION_TYPE.LOW_BALANCE]: () => '/wallet/fund',
  [NOTIFICATION_TYPE.BADGE_UNLOCKED]: () => '/profile',
  [NOTIFICATION_TYPE.LEVEL_UP]: () => '/dashboard/gamification',
  [NOTIFICATION_TYPE.GAMIFICATION_MILESTONE_UNLOCKED]: () => '/dashboard/gamification',
  [NOTIFICATION_TYPE.WEEKLY_SUMMARY]: () => '/dashboard',
  [NOTIFICATION_TYPE.CAMPAIGN_AUTO_PAUSED]: (id) => `/dashboard/campaigns/${id}`,
  [NOTIFICATION_TYPE.CAMPAIGN_AUTO_EXHAUSTED]: (id) => `/dashboard/campaigns/${id}`,
  [NOTIFICATION_TYPE.CAMPAIGN_LOW_BUDGET]: (id) => `/dashboard/campaigns/${id}`,
  [NOTIFICATION_TYPE.SMART_INVITE]: (id) => `/dashboard/campaigns/${id}`,
  [NOTIFICATION_TYPE.CAMPAIGN_COACH]: (id) => `/dashboard/campaigns/${id}`,
  [NOTIFICATION_TYPE.CART_ABANDONED]: () => '/cart',
  [NOTIFICATION_TYPE.SERVICE_INQUIRY]: (id) => `/dashboard/stores/${id}/services`,
};
