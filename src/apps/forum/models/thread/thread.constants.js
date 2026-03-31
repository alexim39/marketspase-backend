// Thread Categories
export const THREAD_CATEGORY = {
  ANNOUNCEMENTS: 'announcements',
  QUESTIONS: 'questions',
  HOW_TO: 'how-to',
  PROMOTIONS: 'promotions',
  SUCCESS_STORIES: 'success-stories',
  FEEDBACK: 'feedback',
  MARKETERS: 'marketers',
  PROMOTERS: 'promoters',
  CONVERSION: 'conversion',
  PAYOUTS: 'payouts',
  BUGS: 'bugs',
  DISCUSSION: 'discussion'
};

export const THREAD_CATEGORY_ARRAY = Object.values(THREAD_CATEGORY);

// Thread Statuses
export const THREAD_STATUS = {
  ACTIVE: 'active',
  LOCKED: 'locked',
  ARCHIVED: 'archived',
  DELETED: 'deleted'
};

export const THREAD_STATUS_ARRAY = Object.values(THREAD_STATUS);

// Thread Sort Options
export const THREAD_SORT = {
  NEWEST: 'newest',
  OLDEST: 'oldest',
  MOST_LIKED: 'most_liked',
  MOST_COMMENTED: 'most_commented',
  MOST_VIEWED: 'most_viewed',
  TRENDING: 'trending'
};

// Validation Rules
export const VALIDATION = {
  TITLE: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 200
  },
  CONTENT: {
    MIN_LENGTH: 10,
    MAX_LENGTH: 5000
  },
  TAGS: {
    MAX_COUNT: 10,
    MAX_LENGTH: 30
  }
};

// Default Values
export const DEFAULTS = {
  CATEGORY: THREAD_CATEGORY.DISCUSSION,
  LIKE_COUNT: 0,
  COMMENT_COUNT: 0,
  VIEW_COUNT: 0,
  IS_PINNED: false,
  IS_LOCKED: false,
  IS_DELETED: false,
  STATUS: THREAD_STATUS.ACTIVE,
  TAGS: []
};

// Trending Calculation
export const TRENDING = {
  VIEW_WEIGHT: 1,
  LIKE_WEIGHT: 3,
  COMMENT_WEIGHT: 5,
  RECENCY_HOURS: 24,
  LOOKBACK_DAYS: 7
};

// Error Messages
export const ERROR_MESSAGES = {
  TITLE_REQUIRED: 'Thread title is required',
  TITLE_TOO_LONG: `Title cannot exceed ${VALIDATION.TITLE.MAX_LENGTH} characters`,
  TITLE_TOO_SHORT: `Title must be at least ${VALIDATION.TITLE.MIN_LENGTH} characters`,
  CONTENT_REQUIRED: 'Thread content is required',
  CONTENT_TOO_LONG: `Content cannot exceed ${VALIDATION.CONTENT.MAX_LENGTH} characters`,
  CONTENT_TOO_SHORT: `Content must be at least ${VALIDATION.CONTENT.MIN_LENGTH} characters`,
  AUTHOR_REQUIRED: 'Author is required',
  THREAD_NOT_FOUND: 'Thread not found',
  UNAUTHORIZED: 'You are not authorized to perform this action',
  TOO_MANY_TAGS: `Cannot add more than ${VALIDATION.TAGS.MAX_COUNT} tags`,
  INVALID_CATEGORY: 'Invalid thread category',
  THREAD_LOCKED: 'This thread is locked and cannot accept new comments',
  THREAD_DELETED: 'This thread has been deleted',
  ALREADY_PINNED: 'Thread is already pinned',
  NOT_PINNED: 'Thread is not pinned'
};

// Success Messages
export const SUCCESS_MESSAGES = {
  THREAD_CREATED: 'Thread created successfully',
  THREAD_UPDATED: 'Thread updated successfully',
  THREAD_DELETED: 'Thread deleted successfully',
  THREAD_LOCKED: 'Thread locked successfully',
  THREAD_UNLOCKED: 'Thread unlocked successfully',
  THREAD_PINNED: 'Thread pinned successfully',
  THREAD_UNPINNED: 'Thread unpinned successfully',
  THREAD_LIKED: 'Thread liked successfully',
  THREAD_UNLIKED: 'Thread unliked successfully'
};

// Activity Actions
export const ACTIVITY_ACTIONS = {
  THREAD_CREATED: 'thread_created',
  THREAD_UPDATED: 'thread_updated',
  THREAD_DELETED: 'thread_deleted',
  THREAD_LIKED: 'thread_liked',
  THREAD_UNLIKED: 'thread_unliked',
  THREAD_LOCKED: 'thread_locked',
  THREAD_UNLOCKED: 'thread_unlocked',
  THREAD_PINNED: 'thread_pinned',
  THREAD_UNPINNED: 'thread_unpinned',
  THREAD_VIEWED: 'thread_viewed'
};