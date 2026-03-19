// Comment Status
export const COMMENT_STATUS = {
  ACTIVE: 'active',
  HIDDEN: 'hidden',
  FLAGGED: 'flagged',
  DELETED: 'deleted'
};

export const COMMENT_STATUS_ARRAY = Object.values(COMMENT_STATUS);

// Comment Sort Options
export const COMMENT_SORT = {
  NEWEST: 'newest',
  OLDEST: 'oldest',
  MOST_LIKED: 'most_liked',
  MOST_REPLIED: 'most_replied'
};

// Validation Rules
export const VALIDATION = {
  CONTENT: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 2000
  },
  REPLY: {
    MAX_LENGTH: 500
  }
};

// Default Values
export const DEFAULTS = {
  LIKE_COUNT: 0,
  IS_DELETED: false,
  STATUS: COMMENT_STATUS.ACTIVE,
  IS_EDITED: false
};

// Error Messages
export const ERROR_MESSAGES = {
  CONTENT_REQUIRED: 'Comment content is required',
  CONTENT_TOO_LONG: `Comment cannot exceed ${VALIDATION.CONTENT.MAX_LENGTH} characters`,
  AUTHOR_REQUIRED: 'Author is required',
  THREAD_REQUIRED: 'Thread is required',
  COMMENT_NOT_FOUND: 'Comment not found',
  UNAUTHORIZED: 'You are not authorized to perform this action',
  PARENT_COMMENT_NOT_FOUND: 'Parent comment not found',
  CANNOT_REPLY_TO_DELETED: 'Cannot reply to a deleted comment',
  ALREADY_LIKED: 'You have already liked this comment',
  NOT_LIKED: 'You have not liked this comment',
  INVALID_SORT: 'Invalid sort option'
};

// Success Messages
export const SUCCESS_MESSAGES = {
  COMMENT_CREATED: 'Comment created successfully',
  COMMENT_UPDATED: 'Comment updated successfully',
  COMMENT_DELETED: 'Comment deleted successfully',
  COMMENT_LIKED: 'Comment liked successfully',
  COMMENT_UNLIKED: 'Comment unliked successfully',
  REPLY_ADDED: 'Reply added successfully'
};

// Activity Actions (for logging)
export const ACTIVITY_ACTIONS = {
  COMMENT_CREATED: 'comment_created',
  COMMENT_UPDATED: 'comment_updated',
  COMMENT_DELETED: 'comment_deleted',
  COMMENT_LIKED: 'comment_liked',
  COMMENT_UNLIKED: 'comment_unliked',
  REPLY_ADDED: 'reply_added'
};

// Text patterns for mentions and hashtags
export const TEXT_PATTERNS = {
  MENTION: /@(\w+)/g,
  HASHTAG: /#(\w+)/g,
  URL: /(https?:\/\/[^\s]+)/g
};