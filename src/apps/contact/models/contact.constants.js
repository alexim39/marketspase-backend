// Contact Reasons
export const CONTACT_REASONS = {
  GENERAL: 'general',
  TECHNICAL: 'technical',
  BILLING: 'billing',
  FEEDBACK: 'feedback',
  REPORT: 'report',
  OTHER: 'other'
};

export const CONTACT_REASONS_ARRAY = Object.values(CONTACT_REASONS);

// Contact Statuses
export const CONTACT_STATUS = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
  SPAM: 'spam'
};

export const CONTACT_STATUS_ARRAY = Object.values(CONTACT_STATUS);

// Contact Priorities
export const CONTACT_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent'
};

export const CONTACT_PRIORITY_ARRAY = Object.values(CONTACT_PRIORITY);

// Contact Categories
export const CONTACT_CATEGORY = {
  SUPPORT: 'support',
  FEATURE_REQUEST: 'feature_request',
  BUG_REPORT: 'bug_report',
  COMPLAINT: 'complaint',
  PRAISE: 'praise',
  PARTNERSHIP: 'partnership'
};

export const CONTACT_CATEGORY_ARRAY = Object.values(CONTACT_CATEGORY);

// Request ID Prefix
export const REQUEST_ID_PREFIX = 'CT';

// Default Values
export const DEFAULTS = {
  STATUS: CONTACT_STATUS.OPEN,
  PRIORITY: CONTACT_PRIORITY.MEDIUM,
  CATEGORY: CONTACT_CATEGORY.SUPPORT,
  IS_READ: false,
  IS_ARCHIVED: false,
  ASSIGNED_TO: null,
  RESOLVED_AT: null,
  RESOLUTION_NOTES: '',
  FOLLOW_UP_DATE: null,
  USER_PHONE: null
};

// Validation Rules
export const VALIDATION = {
  SUBJECT: {
    MAX_LENGTH: 200
  },
  EMAIL: {
    PATTERN: /^\S+@\S+\.\S+$/
  }
};

// Error Messages
export const ERROR_MESSAGES = {
  REASON_REQUIRED: 'Please enter reason',
  SUBJECT_REQUIRED: 'Please enter subject',
  MESSAGE_REQUIRED: 'Please enter message',
  EMAIL_REQUIRED: 'Email is required',
  EMAIL_INVALID: 'Invalid email format',
  CONTACT_NOT_FOUND: 'Contact request not found',
  UNAUTHORIZED_ACCESS: 'Unauthorized access to contact request'
};

// Success Messages
export const SUCCESS_MESSAGES = {
  CONTACT_CREATED: 'Contact request created successfully',
  CONTACT_UPDATED: 'Contact request updated successfully',
  CONTACT_DELETED: 'Contact request deleted successfully',
  NOTE_ADDED: 'Admin note added successfully',
  ASSIGNED: 'Contact request assigned successfully',
  STATUS_UPDATED: 'Status updated successfully'
};

// Activity Actions (for logging)
export const ACTIVITY_ACTIONS = {
  CONTACT_CREATED: 'contact_created',
  CONTACT_UPDATED: 'contact_updated',
  CONTACT_DELETED: 'contact_deleted',
  NOTE_ADDED: 'note_added',
  ASSIGNED: 'assigned',
  STATUS_CHANGED: 'status_changed',
  RESOLVED: 'resolved',
  REOPENED: 'reopened',
  MARKED_READ: 'marked_read',
  ARCHIVED: 'archived'
};