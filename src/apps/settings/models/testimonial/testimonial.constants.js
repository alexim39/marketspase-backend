// Testimonial Status
export const TESTIMONIAL_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

export const TESTIMONIAL_STATUS_ARRAY = Object.values(TESTIMONIAL_STATUS);

// Reaction Types
export const REACTION_TYPE = {
  LIKE: 'like',
  DISLIKE: 'dislike'
};

export const REACTION_TYPE_ARRAY = Object.values(REACTION_TYPE);

// Default Values
export const DEFAULTS = {
  STATUS: TESTIMONIAL_STATUS.PENDING,
  LIKES: 0,
  DISLIKES: 0,
  IS_FEATURED: false,
  RATING: 5,
  REACTIONS: []
};

// Validation Rules
export const VALIDATION = {
  MESSAGE: {
    MAX_LENGTH: 500,
    MIN_LENGTH: 10
  },
  RATING: {
    MIN: 1,
    MAX: 5
  }
};

// Error Messages
export const ERROR_MESSAGES = {
  USER_REQUIRED: 'User is required',
  MESSAGE_REQUIRED: 'Testimonial message is required',
  MESSAGE_TOO_LONG: `Testimonial cannot exceed ${VALIDATION.MESSAGE.MAX_LENGTH} characters`,
  MESSAGE_TOO_SHORT: `Testimonial must be at least ${VALIDATION.MESSAGE.MIN_LENGTH} characters`,
  TESTIMONIAL_NOT_FOUND: 'Testimonial not found',
  UNAUTHORIZED: 'You are not authorized to perform this action',
  INVALID_STATUS: 'Invalid testimonial status',
  INVALID_REACTION: 'Invalid reaction type',
  ALREADY_REACTED: 'You have already reacted to this testimonial',
  REACTION_NOT_FOUND: 'Reaction not found',
  RATING_OUT_OF_RANGE: `Rating must be between ${VALIDATION.RATING.MIN} and ${VALIDATION.RATING.MAX}`,
  CANNOT_MODIFY_APPROVED: 'Cannot modify an approved testimonial'
};

// Success Messages
export const SUCCESS_MESSAGES = {
  TESTIMONIAL_CREATED: 'Testimonial created successfully',
  TESTIMONIAL_UPDATED: 'Testimonial updated successfully',
  TESTIMONIAL_DELETED: 'Testimonial deleted successfully',
  TESTIMONIAL_APPROVED: 'Testimonial approved successfully',
  TESTIMONIAL_REJECTED: 'Testimonial rejected successfully',
  REACTION_ADDED: 'Reaction added successfully',
  REACTION_REMOVED: 'Reaction removed successfully',
  FEATURED_UPDATED: 'Featured status updated successfully'
};

// Activity Actions
export const ACTIVITY_ACTIONS = {
  TESTIMONIAL_CREATED: 'testimonial_created',
  TESTIMONIAL_UPDATED: 'testimonial_updated',
  TESTIMONIAL_DELETED: 'testimonial_deleted',
  TESTIMONIAL_APPROVED: 'testimonial_approved',
  TESTIMONIAL_REJECTED: 'testimonial_rejected',
  TESTIMONIAL_LIKED: 'testimonial_liked',
  TESTIMONIAL_DISLIKED: 'testimonial_disliked',
  TESTIMONIAL_FEATURED: 'testimonial_featured'
};