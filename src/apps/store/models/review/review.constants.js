// Review Status
export const REVIEW_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  FLAGGED: 'flagged'
};

export const REVIEW_STATUS_ARRAY = Object.values(REVIEW_STATUS);

// Device Types
export const DEVICE_TYPE = {
  MOBILE: 'mobile',
  TABLET: 'tablet',
  DESKTOP: 'desktop'
};

export const DEVICE_TYPE_ARRAY = Object.values(DEVICE_TYPE);

// Platform Types
export const PLATFORM_TYPE = {
  IOS: 'ios',
  ANDROID: 'android',
  WEB: 'web'
};

export const PLATFORM_TYPE_ARRAY = Object.values(PLATFORM_TYPE);

// Default Values
export const DEFAULTS = {
  STATUS: REVIEW_STATUS.PENDING,
  HELPFUL_COUNT: 0,
  REPORT_COUNT: 0,
  IS_FEATURED: false,
  VERIFIED_PURCHASE: false,
  HELPFUL_BY: [],
  REPORTED_BY: [],
  IMAGES: []
};

// Validation Rules
export const VALIDATION = {
  RATING: {
    MIN: 1,
    MAX: 5
  },
  TITLE: {
    MAX_LENGTH: 100
  },
  COMMENT: {
    MIN_LENGTH: 10,
    MAX_LENGTH: 2000
  },
  IMAGE_CAPTION: {
    MAX_LENGTH: 200
  },
  RESPONSE_CONTENT: {
    MAX_LENGTH: 1000
  }
};

// Auto-flag Threshold
export const FLAG_THRESHOLD = 5;

// Error Messages
export const ERROR_MESSAGES = {
  PRODUCT_REQUIRED: 'Product ID is required',
  USER_REQUIRED: 'User ID is required',
  STORE_REQUIRED: 'Store ID is required',
  RATING_REQUIRED: 'Rating is required',
  RATING_OUT_OF_RANGE: `Rating must be between ${VALIDATION.RATING.MIN} and ${VALIDATION.RATING.MAX}`,
  COMMENT_REQUIRED: 'Review comment is required',
  COMMENT_TOO_SHORT: `Comment must be at least ${VALIDATION.COMMENT.MIN_LENGTH} characters`,
  COMMENT_TOO_LONG: `Comment cannot exceed ${VALIDATION.COMMENT.MAX_LENGTH} characters`,
  TITLE_TOO_LONG: `Title cannot exceed ${VALIDATION.TITLE.MAX_LENGTH} characters`,
  REVIEW_NOT_FOUND: 'Review not found',
  ALREADY_HELPFUL: 'You have already marked this review as helpful',
  NOT_HELPFUL: 'You have not marked this review as helpful',
  ALREADY_REPORTED: 'You have already reported this review',
  UNAUTHORIZED: 'You are not authorized to perform this action',
  CANNOT_MODIFY_APPROVED: 'Cannot modify an approved review',
  RESPONSE_TOO_LONG: `Response cannot exceed ${VALIDATION.RESPONSE_CONTENT.MAX_LENGTH} characters`
};

// Success Messages
export const SUCCESS_MESSAGES = {
  REVIEW_CREATED: 'Review created successfully',
  REVIEW_UPDATED: 'Review updated successfully',
  REVIEW_DELETED: 'Review deleted successfully',
  REVIEW_APPROVED: 'Review approved successfully',
  REVIEW_REJECTED: 'Review rejected successfully',
  REVIEW_FLAGGED: 'Review flagged successfully',
  HELPFUL_MARKED: 'Review marked as helpful',
  HELPFUL_UNMARKED: 'Review unmarked as helpful',
  REPORT_ADDED: 'Review reported successfully',
  RESPONSE_ADDED: 'Response added successfully'
};

// Activity Actions
export const ACTIVITY_ACTIONS = {
  REVIEW_CREATED: 'review_created',
  REVIEW_UPDATED: 'review_updated',
  REVIEW_DELETED: 'review_deleted',
  REVIEW_APPROVED: 'review_approved',
  REVIEW_REJECTED: 'review_rejected',
  REVIEW_FLAGGED: 'review_flagged',
  REVIEW_HELPFUL: 'review_helpful',
  REVIEW_REPORTED: 'review_reported',
  RESPONSE_ADDED: 'response_added'
};