// Activity Actions
export const ACTIVITY_ACTIONS = {
  // Authentication & Profile
  LOGIN: 'login',
  LOGOUT: 'logout',
  PROFILE_UPDATE: 'profile_update',
  PASSWORD_CHANGE: 'password_change',
  EMAIL_VERIFY: 'email_verify',
  REFERRED_SIGNUP: 'referred_signup',
  SIGNUP: 'signup',
  
  // Wallet & Financial
  WALLET_FUND: 'wallet_fund',
  WITHDRAWAL_REQUEST: 'withdrawal_request',
  WITHDRAWAL_COMPLETE: 'withdrawal_complete',
  TRANSFER: 'transfer',
  PROMO_CREDIT_CLAIMED: 'promo_credit_claimed',
  WITHDRAWAL_APPROVED: 'withdrawal_approved',
  WITHDRAWAL_REJECTED: 'withdrawal_rejected',
  REFERRAL_BONUS_QUALIFIED: 'referral_bonus_qualified',
  REFERRAL_BONUS_PAID: 'referral_bonus_paid',
  REFUND_RECEIVED: 'refund_received',
  BIRTHDAY_BONUS_RECEIVED: 'birthday_bonus_received',
  
  // Campaign & Promotion
  CAMPAIGN_CREATE: 'campaign_create',
  CAMPAIGN_UPDATE: 'campaign_update',
  CAMPAIGN_DELETE: 'campaign_delete',
  CAMPAIGN_PAUSE: 'campaign_pause',
  PROMOTION_SUBMIT: 'promotion_submit',
  PROMOTION_APPROVE: 'promotion_approve',
  PROMOTION_REJECT: 'promotion_reject',
  CAMPAIGN_ACCEPT: 'campaign_accept',
  CAMPAIGN_DOWNLOAD: 'campaign_download',
  CAMPAIGN_CREATED: 'campaign_created',
  PROMOTION_VALIDATED: 'promotion_validated',
  PROMOTION_DOWNLOADED: 'promotion_downloaded',
  
  // Thread & Forum Activities (ADD THIS NEW SECTION)
  THREAD_PINNED: 'thread_pinned',
  THREAD_PINNED_BY_MOD: 'thread_pinned_by_mod',
  THREAD_CREATED: 'thread_created',
  THREAD_DELETED: 'thread_deleted',
  THREAD_UPDATED: 'thread_updated',
  
  // Notification & Settings
  NOTIFICATION_SETTINGS_UPDATE: 'notification_settings_update',
  PREFERENCES_UPDATE: 'preferences_update',
  
  // Account Management
  DEVICE_ADD: 'device_add',
  DEVICE_REMOVE: 'device_remove',
  PAYOUT_ACCOUNT_ADD: 'payout_account_add',
  PAYOUT_ACCOUNT_REMOVE: 'payout_account_remove',
  
  // System
  ROLE_CHANGE: 'role_change',
  ACCOUNT_VERIFY: 'account_verify',
  ACCOUNT_SUSPEND: 'account_suspend'
};

// Activity Actions Array (for schema enum)
export const ACTIVITY_ACTIONS_ARRAY = Object.values(ACTIVITY_ACTIONS);

// Resource Types
export const RESOURCE_TYPES = {
  USER: 'user',
  CAMPAIGN: 'campaign',
  PROMOTION: 'promotion',
  WALLET: 'wallet',
  TRANSACTION: 'transaction',
  NOTIFICATION: 'notification',
  DEVICE: 'device',
  PAYOUT_ACCOUNT: 'payout_account',
  BONUS: 'bonus',
  REFERRAL: 'referral',
  THREAD: 'thread'  // ADD THIS NEW RESOURCE TYPE
};

// Resource Types Array (for schema enum)
export const RESOURCE_TYPES_ARRAY = Object.values(RESOURCE_TYPES);

// Activity Categories for grouping
export const ACTIVITY_CATEGORIES = {
  AUTH: 'authentication',
  PROFILE: 'profile',
  FINANCIAL: 'financial',
  CAMPAIGN: 'campaign',
  PROMOTION: 'promotion',
  SETTINGS: 'settings',
  ACCOUNT: 'account',
  SYSTEM: 'system',
  FORUM: 'forum'  // ADD THIS NEW CATEGORY
};

// Map actions to categories for easier filtering
export const ACTION_TO_CATEGORY = {
  // Authentication
  [ACTIVITY_ACTIONS.LOGIN]: ACTIVITY_CATEGORIES.AUTH,
  [ACTIVITY_ACTIONS.LOGOUT]: ACTIVITY_CATEGORIES.AUTH,
  [ACTIVITY_ACTIONS.SIGNUP]: ACTIVITY_CATEGORIES.AUTH,
  
  // Profile
  [ACTIVITY_ACTIONS.PROFILE_UPDATE]: ACTIVITY_CATEGORIES.PROFILE,
  [ACTIVITY_ACTIONS.PASSWORD_CHANGE]: ACTIVITY_CATEGORIES.PROFILE,
  [ACTIVITY_ACTIONS.EMAIL_VERIFY]: ACTIVITY_CATEGORIES.PROFILE,
  
  // Financial
  [ACTIVITY_ACTIONS.WALLET_FUND]: ACTIVITY_CATEGORIES.FINANCIAL,
  [ACTIVITY_ACTIONS.WITHDRAWAL_REQUEST]: ACTIVITY_CATEGORIES.FINANCIAL,
  [ACTIVITY_ACTIONS.WITHDRAWAL_COMPLETE]: ACTIVITY_CATEGORIES.FINANCIAL,
  [ACTIVITY_ACTIONS.TRANSFER]: ACTIVITY_CATEGORIES.FINANCIAL,
  
  // Campaign
  [ACTIVITY_ACTIONS.CAMPAIGN_CREATE]: ACTIVITY_CATEGORIES.CAMPAIGN,
  [ACTIVITY_ACTIONS.CAMPAIGN_UPDATE]: ACTIVITY_CATEGORIES.CAMPAIGN,
  [ACTIVITY_ACTIONS.CAMPAIGN_DELETE]: ACTIVITY_CATEGORIES.CAMPAIGN,
  
  // Promotion
  [ACTIVITY_ACTIONS.PROMOTION_SUBMIT]: ACTIVITY_CATEGORIES.PROMOTION,
  [ACTIVITY_ACTIONS.PROMOTION_APPROVE]: ACTIVITY_CATEGORIES.PROMOTION,
  
  // Thread & Forum Activities (ADD THESE MAPPINGS)
  [ACTIVITY_ACTIONS.THREAD_PINNED]: ACTIVITY_CATEGORIES.FORUM,
  [ACTIVITY_ACTIONS.THREAD_PINNED_BY_MOD]: ACTIVITY_CATEGORIES.FORUM,
  [ACTIVITY_ACTIONS.THREAD_CREATED]: ACTIVITY_CATEGORIES.FORUM,
  [ACTIVITY_ACTIONS.THREAD_DELETED]: ACTIVITY_CATEGORIES.FORUM,
  [ACTIVITY_ACTIONS.THREAD_UPDATED]: ACTIVITY_CATEGORIES.FORUM,
  
  // Settings
  [ACTIVITY_ACTIONS.NOTIFICATION_SETTINGS_UPDATE]: ACTIVITY_CATEGORIES.SETTINGS,
  [ACTIVITY_ACTIONS.PREFERENCES_UPDATE]: ACTIVITY_CATEGORIES.SETTINGS,
  
  // Account
  [ACTIVITY_ACTIONS.DEVICE_ADD]: ACTIVITY_CATEGORIES.ACCOUNT,
  [ACTIVITY_ACTIONS.DEVICE_REMOVE]: ACTIVITY_CATEGORIES.ACCOUNT,
  
  // System
  [ACTIVITY_ACTIONS.ROLE_CHANGE]: ACTIVITY_CATEGORIES.SYSTEM,
  [ACTIVITY_ACTIONS.ACCOUNT_VERIFY]: ACTIVITY_CATEGORIES.SYSTEM
};

// Severity levels for activities
export const ACTIVITY_SEVERITY = {
  INFO: 'info',
  WARNING: 'warning',
  CRITICAL: 'critical'
};

// Default values
export const DEFAULTS = {
  METADATA: {},
  SEVERITY: ACTIVITY_SEVERITY.INFO
};