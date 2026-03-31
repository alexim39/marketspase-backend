// Promotion Statuses
export const PROMOTION_STATUS = {
  ACCEPTED: 'accepted',
  DOWNLOADED: 'downloaded',
  SUBMITTED: 'submitted',
  VALIDATED: 'validated',
  REJECTED: 'rejected',
  PAID: 'paid'
};

export const PROMOTION_STATUS_ARRAY = Object.values(PROMOTION_STATUS);

// Notification Types
export const NOTIFICATION_TYPES = {
  PROMOTION_ASSIGNED: 'promotion_assigned',
  PROMOTION_DOWNLOADED: 'promotion_downloaded',
  PROMOTION_SUBMITTED: 'promotion_submitted',
  PROMOTION_VALIDATED: 'promotion_validated',
  PROMOTION_REJECTED: 'promotion_rejected',
  PAYMENT_PROCESSED: 'payment_processed',
  SUBMISSION_REMINDER: 'submission_reminder',
  DEADLINE_REMINDER: 'deadline_reminder'
};

export const NOTIFICATION_TYPES_ARRAY = Object.values(NOTIFICATION_TYPES);

// Reminder Types
export const REMINDER_TYPES = {
  SUBMISSION: 'submission',
  VALIDATION: 'validation'
};

// Validation Constants
export const VALIDATION = {
  MIN_PROOF_VIEWS: 35,
  SUBMISSION_REMINDER_HOURS: {
    START: 20,
    END: 24
  },
  OVERDUE_DAYS: 7
};

// Timeouts for external services (ms)
export const SERVICE_TIMEOUTS = {
  NOTIFICATION: 4000
};

// Safety Flags
export const SAFETY_FLAGS = [
  'hasReservedFromMarketer',
  'hasReservedForPromoter',
  'hasBeenPaid',
  'hasBeenRefunded'
];

// Accounting Flags
export const ACCOUNTING_FLAGS = [
  'validatedCounted',
  'paidCounted'
];

// Default Values
export const DEFAULTS = {
  STATUS: PROMOTION_STATUS.ACCEPTED,
  PROOF_VIEWS: 0,
  PAYOUT_AMOUNT: 0,
  IS_DOWNLOADED: false,
  HAS_RESERVED_FROM_MARKETER: false,
  HAS_RESERVED_FOR_PROMOTER: false,
  HAS_BEEN_PAID: false,
  HAS_BEEN_REFUNDED: false,
  REMINDER_SENT_COUNT: 0
};