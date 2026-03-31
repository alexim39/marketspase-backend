// User Roles
export const USER_ROLES = {
  MARKETER: 'marketer',
  PROMOTER: 'promoter',
  ADMIN: 'admin',
  MARKETING_REP: 'marketing_rep'
};

export const USER_ROLES_ARRAY = Object.values(USER_ROLES);

// Authentication Methods
export const AUTH_METHODS = {
  LOCAL: 'local',
  GOOGLE: 'google.com',
  FACEBOOK: 'facebook.com',
  TWITTER: 'twitter.com'
};

export const AUTH_METHODS_ARRAY = Object.values(AUTH_METHODS);

// Notification Channels
export const NOTIFICATION_CHANNELS = {
  EMAIL: 'email',
  PUSH: 'push',
  IN_APP: 'inApp',
  SMS: 'sms'
};

// Notification Types
export const NOTIFICATION_TYPES = {
  // Campaign-related
  CAMPAIGN_ASSIGNED: 'campaignAssigned',
  CAMPAIGN_APPROVED: 'campaignApproved',
  CAMPAIGN_REJECTED: 'campaignRejected',
  CAMPAIGN_PAUSED: 'campaignPaused',
  BUDGET_EXHAUSTED: 'budgetExhausted',
  
  // Promotion-related
  PROMOTION_SUBMITTED: 'promotionSubmitted',
  PROMOTION_VALIDATED: 'promotionValidated',
  PROMOTION_REJECTED: 'promotionRejected',
  SUBMISSION_REMINDER: 'submissionReminder',
  
  // Payment-related
  PAYMENT_RECEIVED: 'paymentReceived',
  PAYMENT_PROCESSED: 'paymentProcessed',
  PAYOUT_READY: 'payoutReady',
  LOW_BALANCE: 'lowBalance',
  
  // System
  WEEKLY_SUMMARY: 'weeklySummary',
  SYSTEM_UPDATES: 'systemUpdates',
  SECURITY_ALERTS: 'securityAlerts'
};

// Device Platforms
export const DEVICE_PLATFORMS = {
  WEB: 'web',
  IOS: 'ios',
  ANDROID: 'android'
};

// Activity Retention Periods
export const ACTIVITY_RETENTION = {
  MIN_DAYS: 30,
  MAX_DAYS: 1095, // 3 years
  DEFAULT_DAYS: 365
};

// Default Values
export const DEFAULTS = {
  AVATAR: '/img/avatar.png',
  CURRENCY: 'NGN',
  BALANCE: 0,
  RESERVED: 0,
  RATING: 0,
  RATING_COUNT: 0,
  IS_ACTIVE: true,
  IS_VERIFIED: false,
  IS_DELETED: false,
  IS_MARKETING_REP: false
};

// Role-specific default notification settings
export const ROLE_DEFAULT_NOTIFICATIONS = {
  [USER_ROLES.MARKETER]: {
    [NOTIFICATION_TYPES.CAMPAIGN_APPROVED]: { inApp: true, email: true, push: true },
    [NOTIFICATION_TYPES.CAMPAIGN_REJECTED]: { inApp: true, email: true, push: true },
    [NOTIFICATION_TYPES.BUDGET_EXHAUSTED]: { inApp: true, email: true, push: true },
    [NOTIFICATION_TYPES.PROMOTION_SUBMITTED]: { inApp: true, email: false, push: true },
    [NOTIFICATION_TYPES.LOW_BALANCE]: { inApp: true, email: true, push: true },
    [NOTIFICATION_TYPES.WEEKLY_SUMMARY]: { inApp: true, email: true, push: false }
  },
  [USER_ROLES.PROMOTER]: {
    [NOTIFICATION_TYPES.CAMPAIGN_ASSIGNED]: { inApp: true, email: false, push: true },
    [NOTIFICATION_TYPES.PROMOTION_VALIDATED]: { inApp: true, email: false, push: true },
    [NOTIFICATION_TYPES.PROMOTION_REJECTED]: { inApp: true, email: false, push: true },
    [NOTIFICATION_TYPES.SUBMISSION_REMINDER]: { inApp: true, email: false, push: true },
    [NOTIFICATION_TYPES.PAYMENT_RECEIVED]: { inApp: true, email: true, push: true },
    [NOTIFICATION_TYPES.PAYOUT_READY]: { inApp: true, email: true, push: true },
    [NOTIFICATION_TYPES.WEEKLY_SUMMARY]: { inApp: true, email: true, push: false }
  },
  [USER_ROLES.ADMIN]: {
    [NOTIFICATION_TYPES.SYSTEM_UPDATES]: { inApp: true, email: true, push: true },
    [NOTIFICATION_TYPES.SECURITY_ALERTS]: { inApp: true, email: true, push: true }
  }
};