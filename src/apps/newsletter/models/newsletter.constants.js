// Newsletter Status
export const NEWSLETTER_STATUS = {
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  SENDING: 'sending',
  SENT: 'sent',
  CANCELLED: 'cancelled',
  FAILED: 'failed'
};

export const NEWSLETTER_STATUS_ARRAY = Object.values(NEWSLETTER_STATUS);

// Send Options
export const SEND_OPTION = {
  DRAFT: 'draft',
  NOW: 'now',
  SCHEDULE: 'schedule'
};

export const SEND_OPTION_ARRAY = Object.values(SEND_OPTION);

// Recipient Types
export const RECIPIENT_TYPE = {
  ALL: 'all',
  MARKETERS: 'marketers',
  PROMOTERS: 'promoters',
  EXTERNAL: 'external'
};

export const RECIPIENT_TYPE_ARRAY = Object.values(RECIPIENT_TYPE);

// Delivery Status
export const DELIVERY_STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  BOUNCED: 'bounced',
  COMPLAINED: 'complained',
  FAILED: 'failed'
};

export const DELIVERY_STATUS_ARRAY = Object.values(DELIVERY_STATUS);

// Service Providers
export const SERVICE_PROVIDER = {
  SENDGRID: 'sendgrid',
  MAILGUN: 'mailgun',
  SES: 'ses',
  SMTP: 'smtp'
};

export const SERVICE_PROVIDER_ARRAY = Object.values(SERVICE_PROVIDER);

// A/B Testing Variation Types
export const VARIATION_TYPE = {
  SUBJECT: 'subject',
  CONTENT: 'content',
  BOTH: 'both'
};

export const VARIATION_TYPE_ARRAY = Object.values(VARIATION_TYPE);

// Default Values
export const DEFAULTS = {
  STATUS: NEWSLETTER_STATUS.DRAFT,
  SEND_OPTION: SEND_OPTION.DRAFT,
  RECIPIENT_TYPE: RECIPIENT_TYPE.ALL,
  SERVICE_PROVIDER: SERVICE_PROVIDER.SENDGRID,
  CURRENT_VERSION: 1,
  IS_ACTIVE: true,
  IS_DELETED: false,
  OPEN_RATE: 0,
  CLICK_RATE: 0,
  BOUNCE_RATE: 0,
  COMPLAINT_RATE: 0,
  TOTAL_OPENS: 0,
  TOTAL_CLICKS: 0,
  UNIQUE_OPENS: 0,
  UNIQUE_CLICKS: 0,
  UNSUBSCRIBES: 0,
  ESTIMATED_RECIPIENTS: 0,
  ACTUAL_RECIPIENTS: 0
};

// Validation Rules
export const VALIDATION = {
  TITLE: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 200
  },
  SUBJECT: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 150
  },
  PREVIEW_TEXT: {
    MAX_LENGTH: 150
  },
  CONTENT: {
    MIN_LENGTH: 10
  },
  EMAIL: {
    PATTERN: /^\S+@\S+\.\S+$/
  }
};

// Cleanup Configuration
export const CLEANUP = {
  SOFT_DELETE_DAYS: 30 // Delete permanently after 30 days
};

// Error Messages
export const ERROR_MESSAGES = {
  TITLE_REQUIRED: 'Title is required',
  TITLE_TOO_LONG: `Title cannot exceed ${VALIDATION.TITLE.MAX_LENGTH} characters`,
  SUBJECT_REQUIRED: 'Subject is required',
  SUBJECT_TOO_LONG: `Subject cannot exceed ${VALIDATION.SUBJECT.MAX_LENGTH} characters`,
  CONTENT_REQUIRED: 'Content is required',
  CONTENT_TOO_SHORT: `Content must be at least ${VALIDATION.CONTENT.MIN_LENGTH} characters`,
  RECIPIENT_TYPE_REQUIRED: 'Recipient type is required',
  CREATED_BY_REQUIRED: 'Creator is required',
  NEWSLETTER_NOT_FOUND: 'Newsletter not found',
  VERSION_NOT_FOUND: (version) => `Version ${version} not found`,
  INVALID_EMAIL: 'Invalid email format',
  CANNOT_MODIFY_SENT: 'Cannot modify a newsletter that has already been sent',
  CANNOT_SEND_EMPTY: 'Cannot send newsletter with no recipients',
  INVALID_STATUS: 'Invalid newsletter status',
  UNAUTHORIZED: 'You are not authorized to perform this action'
};

// Success Messages
export const SUCCESS_MESSAGES = {
  NEWSLETTER_CREATED: 'Newsletter created successfully',
  NEWSLETTER_UPDATED: 'Newsletter updated successfully',
  NEWSLETTER_DELETED: 'Newsletter deleted successfully',
  NEWSLETTER_SENT: 'Newsletter sent successfully',
  NEWSLETTER_SCHEDULED: 'Newsletter scheduled successfully',
  NEWSLETTER_CANCELLED: 'Newsletter cancelled successfully',
  VERSION_CREATED: 'New content version created',
  VERSION_RESTORED: 'Content version restored'
};