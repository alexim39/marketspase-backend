import { VALIDATION, TRENDING_WEIGHTS, TRENDING } from "./feed.constants.js";

/**
 * Extract hashtags from content
 * @param {string} content - Post content
 * @returns {Array} - Array of hashtag objects
 */
export const extractHashtags = (content) => {
  const matches = content.match(VALIDATION.HASHTAG.PATTERN);
  if (!matches) return [];
  
  return matches.map(tag => ({
    tag: tag.substring(1).toLowerCase()
  }));
};

export const normalizeHashtagInput = (hashtags = []) => {
  if (!Array.isArray(hashtags)) return [];

  return hashtags
    .map((entry) => {
      if (typeof entry === 'string') return entry;
      if (entry && typeof entry === 'object' && typeof entry.tag === 'string') {
        return entry.tag;
      }
      return '';
    })
    .map((tag) => tag.trim().replace(/^#/, '').toLowerCase())
    .filter(Boolean)
    .map((tag) => ({ tag }));
};

export const mergeHashtags = (...groups) => {
  const seen = new Set();

  return groups
    .flatMap((group) => normalizeHashtagInput(group))
    .filter(({ tag }) => {
      if (seen.has(tag)) return false;
      seen.add(tag);
      return true;
    });
};

/**
 * Extract mentions from content
 * @param {string} content - Post content
 * @returns {Array} - Array of mention objects
 */
export const extractMentions = (content) => {
  const matches = content.match(VALIDATION.MENTION.PATTERN);
  if (!matches) return [];
  
  return matches.map(mention => ({
    username: mention.substring(1)
  }));
};

/**
 * Calculate trending score for a post
 * @param {Object} post - Post object with engagement metrics
 * @returns {number} - Trending score
 */
export const calculateTrendingScore = (post) => {
  const now = new Date();
  const hoursAgo = (now - post.createdAt) / (1000 * 60 * 60);
  
  const likeWeight = post.likes?.length * TRENDING_WEIGHTS.LIKE || 0;
  const commentWeight = post.comments?.length * TRENDING_WEIGHTS.COMMENT || 0;
  const shareWeight = post.shares?.length * TRENDING_WEIGHTS.SHARE || 0;
  const saveWeight = post.savedBy?.length * TRENDING_WEIGHTS.SAVE || 0;
  const impressionWeight = Math.log((post.reach?.impressions || 0) + 1) * TRENDING_WEIGHTS.IMPRESSION;
  
  const decayFactor = Math.exp(-hoursAgo / TRENDING.DECAY_HOURS);
  
  return (likeWeight + commentWeight + shareWeight + saveWeight + impressionWeight) * decayFactor;
};

export const computeFreshnessBoost = (createdAt) => {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return 0;

  const hoursAgo = (Date.now() - created.getTime()) / (1000 * 60 * 60);
  return Math.max(0, 18 - Math.min(hoursAgo, 18));
};

export const getPrimaryMediaType = (post) => {
  if (!Array.isArray(post?.media) || post.media.length === 0) return null;
  return post.media[0]?.type || null;
};

/**
 * Format post for response
 * @param {Object} post - Post document
 * @param {string} userId - Current user ID for checking interactions
 * @returns {Object} - Formatted post
 */
export const formatPostResponse = (post, userId = null) => {
  const postObj = post.toObject ? post.toObject() : post;
  const chatCount = post.socialMetrics?.chatClicks || post.socialMetrics?.externalClicks || 0;
  
  return {
    ...postObj,
    likeCount: post.likes?.length || 0,
    commentCount: post.comments?.length || 0,
    saveCount: post.savedBy?.length || 0,
    shareCount: post.shares?.length || 0,
    chatCount,
    uniqueViewCount: post.reach?.uniqueViews?.length || 0,
    isLiked: userId ? post.likes?.some(like => like.user?.toString() === userId.toString()) : false,
    isSaved: userId ? post.savedBy?.some(saved => saved.user?.toString() === userId.toString()) : false,
    hasUserViewed: userId ? post.reach?.uniqueViews?.includes(userId) : false
  };
};

/**
 * Format comment for response
 * @param {Object} comment - Comment object
 * @param {string} userId - Current user ID for checking interactions
 * @returns {Object} - Formatted comment
 */
export const formatCommentResponse = (comment, userId = null) => {
  return {
    ...comment,
    likeCount: comment.likes?.length || 0,
    replyCount: comment.replies?.length || 0,
    isLiked: userId ? comment.likes?.includes(userId) : false
  };
};

/**
 * Get time ago string
 * @param {Date} date - Date to compare
 * @returns {string} - Time ago string
 */
export const getTimeAgo = (date) => {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  
  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60
  };
  
  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit);
    if (interval >= 1) {
      return `${interval} ${unit}${interval === 1 ? '' : 's'} ago`;
    }
  }
  
  return 'just now';
};
