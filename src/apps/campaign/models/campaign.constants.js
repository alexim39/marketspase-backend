// Campaign Statuses
export const CAMPAIGN_STATUS = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  REJECTED: 'rejected',
  COMPLETED: 'completed',
  EXHAUSTED: 'exhausted',
  EXPIRED: 'expired',
  PENDING: 'pending',
  DRAFT: 'draft',
  ARCHIVED: 'archived'
};

export const CAMPAIGN_STATUS_ARRAY = Object.values(CAMPAIGN_STATUS);

// Campaign Types
export const CAMPAIGN_TYPE = {
  STANDARD: 'standard',
  PREMIUM: 'premium',
  BOOST: 'boost'
};

export const CAMPAIGN_TYPE_ARRAY = Object.values(CAMPAIGN_TYPE);

// Campaign Priority
export const CAMPAIGN_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high'
};

export const CAMPAIGN_PRIORITY_ARRAY = Object.values(CAMPAIGN_PRIORITY);

// Media Types
export const MEDIA_TYPE = {
  IMAGE: 'image',
  VIDEO: 'video'
};

export const MEDIA_TYPE_ARRAY = Object.values(MEDIA_TYPE);

// Payout Models
export const PAYOUT_MODEL = {
  FIXED_PER_PROMOTER: 'fixed_per_promoter',
  PAY_PER_CLICK: 'pay_per_click'
};

export const PAYOUT_MODEL_ARRAY = Object.values(PAYOUT_MODEL);

// Age Targets
export const AGE_TARGET = {
  ALL: 'all',
  YOUNG: 'young',
  MIDDLE: 'middle',
  ADVANCED: 'advanced'
};

export const AGE_TARGET_ARRAY = Object.values(AGE_TARGET);

// Promotion Types
export const PROMOTION_TYPE = {
  PRODUCT_PROMOTION: 'product_promotion',
  STORE_PROMOTION: 'store_promotion',
  CATEGORY_PROMOTION: 'category_promotion'
};

export const PROMOTION_TYPE_ARRAY = Object.values(PROMOTION_TYPE);

// Promotion Goals
export const PROMOTION_GOAL = {
  AWARENESS: 'awareness',
  TRAFFIC: 'traffic',
  CONVERSIONS: 'conversions',
  SALES: 'sales'
};

export const PROMOTION_GOAL_ARRAY = Object.values(PROMOTION_GOAL);

// Difficulty Levels
export const DIFFICULTY = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard'
};

export const DIFFICULTY_ARRAY = Object.values(DIFFICULTY);

// Notification Types
export const NOTIFICATION_TYPES = {
  CAMPAIGN_APPROVED: 'campaign_approved',
  CAMPAIGN_REJECTED: 'campaign_rejected',
  BUDGET_EXHAUSTED: 'budget_exhausted',
  SUBMISSION_REMINDER: 'submission_reminder',
  PROMOTION_ASSIGNED: 'promotion_assigned',
  PROMOTION_SUBMITTED: 'promotion_submitted',
  PROMOTION_VALIDATED: 'promotion_validated',
  PROMOTION_REJECTED: 'promotion_rejected',
  LOW_BALANCE: 'low_balance',
  PAYMENT_PROCESSED: 'payment_processed',
  DEADLINE_REMINDER: 'deadline_reminder',
  PROMOTION_APENDING: 'promotion_apending'
};

export const NOTIFICATION_TYPES_ARRAY = Object.values(NOTIFICATION_TYPES);

// Default Values
export const DEFAULTS = {
  CURRENCY: 'NGN',
  MIN_BUDGET: 1000,
  MIN_PROMOTERS: 1,
  CURRENT_PROMOTERS: 0,
  SPENT_BUDGET: 0,
  RESERVED_BUDGET: 0,
  TOTAL_PROMOTIONS: 0,
  VALIDATED_PROMOTIONS: 0,
  PAID_PROMOTIONS: 0,
  REJECTED_PROMOTIONS: 0,
  TOTAL_PAYOUTS: 0,
  COST_PER_CLICK: 80,
  TOTAL_CLICKS: 0,
  BILLABLE_CLICKS: 0,
  INVALID_CLICKS: 0,
  DUPLICATE_CLICKS: 0,
  MIN_RATING: 0,
  ENABLE_TARGET: false,
  HAS_END_DATE: false,
  IS_DELETED: false,
  PRIORITY: CAMPAIGN_PRIORITY.LOW,
  CAMPAIGN_TYPE: CAMPAIGN_TYPE.STANDARD,
  PAYOUT_MODEL: PAYOUT_MODEL.PAY_PER_CLICK,
  AGE_TARGET: AGE_TARGET.ALL,
  PROMOTION_TYPE: PROMOTION_TYPE.PRODUCT_PROMOTION,
  PROMOTION_GOAL: PROMOTION_GOAL.TRAFFIC,
  DIFFICULTY: DIFFICULTY.MEDIUM
};

// Thresholds
export const THRESHOLDS = {
  BUDGET_ALERT_PERCENTAGE: 80,
  SUBMISSION_REMINDER_FREQUENCY_HOURS: 48,
  DEADLINE_APPROACHING_DAYS: 3,
  RECENT_NOTIFICATION_HOURS: 24
};

// Validation Rules
export const VALIDATION = {
  BUDGET: {
    MIN: 1000
  },
  MAX_PROMOTERS: {
    MIN: 1
  },
  RATING: {
    MIN: 0,
    MAX: 5
  }
};
