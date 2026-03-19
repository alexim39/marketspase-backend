// Message Types
export const MESSAGE_TYPE = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
  SUCCESS: 'SUCCESS',
  MAINTENANCE: 'MAINTENANCE'
};

export const MESSAGE_TYPE_ARRAY = Object.values(MESSAGE_TYPE);

// Message Priorities
export const MESSAGE_PRIORITY = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
};

export const MESSAGE_PRIORITY_ARRAY = Object.values(MESSAGE_PRIORITY);

// Target Audiences
export const TARGET_AUDIENCE = {
  ALL: 'ALL',
  NEW_USERS: 'NEW_USERS',
  EXISTING_USERS: 'EXISTING_USERS',
  SPECIFIC_GROUP: 'SPECIFIC_GROUP'
};

export const TARGET_AUDIENCE_ARRAY = Object.values(TARGET_AUDIENCE);

// Default Values
export const DEFAULTS = {
  TYPE: MESSAGE_TYPE.INFO,
  PRIORITY: MESSAGE_PRIORITY.MEDIUM,
  TARGET_AUDIENCE: TARGET_AUDIENCE.ALL,
  IS_ACTIVE: true,
  SHOW_BANNER: true,
  BANNER_COLOR: '#1976d2',
  TEXT_COLOR: '#ffffff',
  ICON: null,
  ACTION_LINK: null,
  ACTION_TEXT: null,
  DISMISSIBLE: true,
  SPECIFIC_USER_GROUPS: []
};

// Color Themes
export const COLOR_THEMES = {
  [MESSAGE_TYPE.INFO]: {
    banner: '#1976d2',
    text: '#ffffff',
    icon: 'info-circle'
  },
  [MESSAGE_TYPE.WARNING]: {
    banner: '#ff9800',
    text: '#000000',
    icon: 'exclamation-triangle'
  },
  [MESSAGE_TYPE.ERROR]: {
    banner: '#f44336',
    text: '#ffffff',
    icon: 'times-circle'
  },
  [MESSAGE_TYPE.SUCCESS]: {
    banner: '#4caf50',
    text: '#ffffff',
    icon: 'check-circle'
  },
  [MESSAGE_TYPE.MAINTENANCE]: {
    banner: '#9e9e9e',
    text: '#ffffff',
    icon: 'tools'
  }
};

// Validation Rules
export const VALIDATION = {
  TITLE: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 100
  },
  MESSAGE: {
    MIN_LENGTH: 10,
    MAX_LENGTH: 500
  },
  DATE_RANGE: {
    MAX_DAYS: 365 // Maximum banner duration in days
  }
};

// Error Messages
export const ERROR_MESSAGES = {
  TITLE_REQUIRED: 'Title is required',
  MESSAGE_REQUIRED: 'Message is required',
  START_DATE_REQUIRED: 'Start date is required',
  END_DATE_REQUIRED: 'End date is required',
  CREATED_BY_REQUIRED: 'Creator is required',
  INVALID_DATE_RANGE: 'End date must be after start date',
  DATE_RANGE_TOO_LONG: `Banner duration cannot exceed ${VALIDATION.DATE_RANGE.MAX_DAYS} days`,
  BANNER_NOT_FOUND: 'Banner message not found',
  USER_DISMISSAL_NOT_FOUND: 'User dismissal record not found'
};

// Success Messages
export const SUCCESS_MESSAGES = {
  BANNER_CREATED: 'Banner message created successfully',
  BANNER_UPDATED: 'Banner message updated successfully',
  BANNER_DELETED: 'Banner message deleted successfully',
  BANNER_DISMISSED: 'Banner dismissed successfully'
};