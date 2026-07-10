// Feed Post Types
export const FEED_POST_TYPE = {
  EARNINGS: 'earnings',
  CAMPAIGN: 'campaign',
  PRODUCT: 'product',
  STORY: 'story',
  CHALLENGE: 'challenge',
  QUESTION: 'question',
  TIP: 'tip',
  ACHIEVEMENT: 'achievement',
  MILESTONE: 'milestone'
};

export const FEED_POST_TYPE_ARRAY = Object.values(FEED_POST_TYPE);

// Feed Post Statuses
export const FEED_POST_STATUS = {
  PUBLISHED: 'published',
  DRAFT: 'draft',
  ARCHIVED: 'archived',
  REPORTED: 'reported'
};

export const FEED_POST_STATUS_ARRAY = Object.values(FEED_POST_STATUS);

// Campaign Statuses (reused from campaign model)
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

// Media Types
export const MEDIA_TYPE = {
  IMAGE: 'image',
  VIDEO: 'video',
  LINK: 'link',
  DOCUMENT: 'document'
};

export const MEDIA_TYPE_ARRAY = Object.values(MEDIA_TYPE);

// Share Platforms
export const SHARE_PLATFORM = {
  TWITTER: 'twitter',
  LINKEDIN: 'linkedin',
  FACEBOOK: 'facebook',
  WHATSAPP: 'whatsapp',
  INSTAGRAM: 'instagram',
  TIKTOK: 'tiktok',
  NATIVE: 'native',
  COPY: 'copy',
  MARKETSPASE: 'marketspase',
  OTHER: 'other'
};

export const SHARE_PLATFORM_ARRAY = Object.values(SHARE_PLATFORM);

// Badge Types
export const BADGE_TYPE = {
  TOP_PROMOTER: 'top-promoter',
  VERIFIED: 'verified',
  RISING_STAR: 'rising-star',
  EXPERT: 'expert',
  VETERAN: 'veteran'
};

export const BADGE_TYPE_ARRAY = [...Object.values(BADGE_TYPE), null];

// Location Type
export const LOCATION_TYPE = {
  POINT: 'Point'
};

// Default Values
export const DEFAULTS = {
  TYPE: FEED_POST_TYPE.QUESTION,
  STATUS: FEED_POST_STATUS.PUBLISHED,
  CURRENCY: 'NGN',
  EARNINGS_AMOUNT: 0,
  TIP_VIEWS: 0,
  REACH_IMPRESSIONS: 0,
  TRENDING_SCORE: 0,
  IS_FEATURED: false,
  HASHTAGS: [],
  MENTIONS: [],
  MEDIA: [],
  MODERATION_FLAGGED: false,
  REACH_UNIQUE_VIEWS: []
};

// Validation Rules
export const VALIDATION = {
  CONTENT: {
    MAX_LENGTH: 5000
  },
  COMMENT: {
    MAX_LENGTH: 1000
  },
  REPLY: {
    MAX_LENGTH: 500
  },
  HASHTAG: {
    PATTERN: /#(\w+)/g
  },
  MENTION: {
    PATTERN: /@(\w+)/g
  }
};

// Trending Score Weights
export const TRENDING_WEIGHTS = {
  LIKE: 3,
  COMMENT: 5,
  SHARE: 4,
  SAVE: 2,
  IMPRESSION: 0.5
};

// Trending Calculation
export const TRENDING = {
  DECAY_HOURS: 24,
  LOOKBACK_DAYS: 3
};

// Error Messages
export const ERROR_MESSAGES = {
  POST_NOT_FOUND: 'Feed post not found',
  AUTHOR_REQUIRED: 'Author is required',
  CONTENT_REQUIRED: 'Content is required',
  INVALID_TYPE: 'Invalid post type',
  INVALID_STATUS: 'Invalid post status',
  UNAUTHORIZED: 'You are not authorized to perform this action',
  COMMENT_NOT_FOUND: 'Comment not found',
  REPLY_NOT_FOUND: 'Reply not found',
  ALREADY_LIKED: 'You have already liked this post',
  NOT_LIKED: 'You have not liked this post',
  ALREADY_SAVED: 'You have already saved this post',
  NOT_SAVED: 'You have not saved this post'
};

// Success Messages
export const SUCCESS_MESSAGES = {
  POST_CREATED: 'Post created successfully',
  POST_UPDATED: 'Post updated successfully',
  POST_DELETED: 'Post deleted successfully',
  POST_LIKED: 'Post liked successfully',
  POST_UNLIKED: 'Post unliked successfully',
  POST_SAVED: 'Post saved successfully',
  POST_UNSAVED: 'Post unsaved successfully',
  COMMENT_ADDED: 'Comment added successfully',
  COMMENT_DELETED: 'Comment deleted successfully',
  REPLY_ADDED: 'Reply added successfully'
};
