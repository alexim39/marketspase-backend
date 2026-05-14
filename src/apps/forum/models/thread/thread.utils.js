import { TRENDING } from "./thread.constants.js";

/**
 * Validate thread title
 * @param {string} title - Thread title
 * @returns {Object} - Validation result
 */
export const validateTitle = (title) => {
  if (!title || title.trim().length === 0) {
    return {
      isValid: false,
      error: 'Title is required'
    };
  }

  const trimmedTitle = title.trim();
  
  if (trimmedTitle.length < 3) {
    return {
      isValid: false,
      error: 'Title must be at least 3 characters long'
    };
  }

  if (trimmedTitle.length > 200) {
    return {
      isValid: false,
      error: 'Title cannot exceed 200 characters'
    };
  }

  return {
    isValid: true,
    title: trimmedTitle
  };
};

/**
 * Validate thread content
 * @param {string} content - Thread content
 * @returns {Object} - Validation result
 */
export const validateContent = (content) => {
  if (!content || content.trim().length === 0) {
    return {
      isValid: false,
      error: 'Content is required'
    };
  }

  const trimmedContent = content.trim();
  
  if (trimmedContent.length < 10) {
    return {
      isValid: false,
      error: 'Content must be at least 10 characters long'
    };
  }

  if (trimmedContent.length > 5000) {
    return {
      isValid: false,
      error: 'Content cannot exceed 5000 characters'
    };
  }

  return {
    isValid: true,
    content: trimmedContent
  };
};

/**
 * Validate tags
 * @param {Array} tags - Array of tags
 * @returns {Object} - Validation result
 */
export const validateTags = (tags) => {
  if (!tags || tags.length === 0) {
    return { isValid: true, tags: [] };
  }

  if (tags.length > 10) {
    return {
      isValid: false,
      error: 'Cannot add more than 10 tags'
    };
  }

  const validTags = tags
    .map(tag => tag.trim().toLowerCase())
    .filter(tag => tag.length > 0 && tag.length <= 30)
    .filter((tag, index, self) => self.indexOf(tag) === index); // Remove duplicates

  return {
    isValid: true,
    tags: validTags
  };
};

/**
 * Calculate trending score
 * @param {Object} thread - Thread document
 * @returns {number} - Trending score
 */
export const calculateTrendingScore = (thread) => {
  const now = new Date();
  const hoursAgo = (now - thread.createdAt) / (1000 * 60 * 60);
  
  // Decay factor - newer threads get higher score
  const decayFactor = Math.exp(-hoursAgo / TRENDING.RECENCY_HOURS);
  
  const viewScore = (thread.viewCount || 0) * TRENDING.VIEW_WEIGHT;
  const likeScore = (thread.likeCount || 0) * TRENDING.LIKE_WEIGHT;
  const commentScore = (thread.commentCount || 0) * TRENDING.COMMENT_WEIGHT;
  
  return (viewScore + likeScore + commentScore) * decayFactor;
};

/**
 * Format thread for response
 * @param {Object} thread - Thread document
 * @param {string} userId - Current user ID for checking interactions
 * @returns {Object} - Formatted thread
 */
export const formatThreadResponse = (thread, userId = null) => {
  const threadObj = thread.toObject ? thread.toObject() : thread;
  const mediaItems = Array.isArray(threadObj.mediaItems) && threadObj.mediaItems.length
    ? threadObj.mediaItems
    : threadObj.media?.url
      ? [threadObj.media]
      : [];
  
  // Handle deleted threads
  if (threadObj.isDeleted) {
    return {
      id: threadObj._id,
      title: '[Thread deleted]',
      content: '[Thread deleted]',
      author: threadObj.author,
      isDeleted: true,
      deletedAt: threadObj.deletedAt,
      createdAt: threadObj.createdAt
    };
  }

  const formatted = {
    id: threadObj._id,
    title: threadObj.title,
    content: threadObj.content,
    author: threadObj.author,
    tags: threadObj.tags || [],
    media: mediaItems[0] || threadObj.media || null,
    mediaItems,
    mediaCount: mediaItems.length,
    isCarousel: mediaItems.length > 1,
    category: threadObj.category,
    topicTags: threadObj.topicTags || [],
    poll: threadObj.poll || null,
    likeCount: threadObj.likeCount || 0,
    commentCount: threadObj.commentCount || 0,
    viewCount: threadObj.viewCount || 0,
    shareCount: threadObj.shareCount || 0,
    followerCount: threadObj.followerCount || 0,
    isPinned: threadObj.isPinned || false,
    isLocked: threadObj.isLocked || false,
    status: threadObj.status || 'active',
    createdAt: threadObj.createdAt,
    updatedAt: threadObj.updatedAt
  };

  // Add user-specific flags
  if (userId) {
    formatted.isLiked = threadObj.likedBy?.some?.((entry) => entry?.toString?.() === userId.toString()) || false;
    formatted.isFollowing = threadObj.followers?.some?.((entry) => entry?.toString?.() === userId.toString()) || false;
    formatted.isOwnThread = threadObj.author?._id?.toString() === userId.toString() || 
                           threadObj.author?.toString() === userId.toString();
  }

  // Add time ago
  formatted.timeAgo = getTimeAgo(threadObj.createdAt);

  // Add last activity
  if (threadObj.lastActivityAt) {
    formatted.lastActivityAt = threadObj.lastActivityAt;
    formatted.lastActivityTimeAgo = getTimeAgo(threadObj.lastActivityAt);
  }

  return formatted;
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

/**
 * Generate slug from title
 * @param {string} title - Thread title
 * @returns {string} - URL-friendly slug
 */
export const generateSlug = (title) => {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/gi, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 100);
};

/**
 * Extract mentions from content
 * @param {string} content - Thread content
 * @returns {Array} - Array of mentioned usernames
 */
export const extractMentions = (content) => {
  const mentionRegex = /@(\w+)/g;
  const mentions = content.match(mentionRegex);
  if (!mentions) return [];
  
  return mentions.map(mention => mention.substring(1)); // Remove @ symbol
};

/**
 * Extract hashtags from content
 * @param {string} content - Thread content
 * @returns {Array} - Array of hashtags
 */
export const extractHashtags = (content) => {
  const hashtagRegex = /#(\w+)/g;
  const hashtags = content.match(hashtagRegex);
  if (!hashtags) return [];
  
  return hashtags.map(tag => tag.substring(1).toLowerCase()); // Remove # and lowercase
};
