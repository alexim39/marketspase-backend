import { VALIDATION, TEXT_PATTERNS } from "./comment.constants.js";

/**
 * Validate comment content
 * @param {string} content - Comment content
 * @returns {Object} - Validation result
 */
export const validateContent = (content) => {
  if (!content || content.trim().length === 0) {
    return {
      isValid: false,
      error: 'Content cannot be empty'
    };
  }

  if (content.length > VALIDATION.CONTENT.MAX_LENGTH) {
    return {
      isValid: false,
      error: `Content cannot exceed ${VALIDATION.CONTENT.MAX_LENGTH} characters`
    };
  }

  return {
    isValid: true,
    content: content.trim()
  };
};

/**
 * Extract mentions from content
 * @param {string} content - Comment content
 * @returns {Array} - Array of mentioned usernames
 */
export const extractMentions = (content) => {
  const mentions = content.match(TEXT_PATTERNS.MENTION);
  if (!mentions) return [];
  
  return mentions.map(mention => mention.substring(1)); // Remove @ symbol
};

/**
 * Extract hashtags from content
 * @param {string} content - Comment content
 * @returns {Array} - Array of hashtags
 */
export const extractHashtags = (content) => {
  const hashtags = content.match(TEXT_PATTERNS.HASHTAG);
  if (!hashtags) return [];
  
  return hashtags.map(tag => tag.substring(1).toLowerCase()); // Remove # and lowercase
};

/**
 * Extract URLs from content
 * @param {string} content - Comment content
 * @returns {Array} - Array of URLs
 */
export const extractUrls = (content) => {
  return content.match(TEXT_PATTERNS.URL) || [];
};

/**
 * Format comment for response
 * @param {Object} comment - Comment document
 * @param {string} userId - Current user ID for checking interactions
 * @returns {Object} - Formatted comment
 */
export const formatCommentResponse = (comment, userId = null) => {
  const commentObj = comment.toObject ? comment.toObject() : comment;
  
  // Handle deleted comments
  if (commentObj.isDeleted) {
    return {
      id: commentObj._id,
      author: commentObj.author,
      content: '[Comment deleted]',
      isDeleted: true,
      deletedAt: commentObj.deletedAt,
      createdAt: commentObj.createdAt
    };
  }

  const formatted = {
    id: commentObj._id,
    content: commentObj.content,
    author: commentObj.author,
    thread: commentObj.thread,
    parentComment: commentObj.parentComment,
    likeCount: commentObj.likeCount || 0,
    replyCount: commentObj.replyCount || 0,
    isEdited: commentObj.isEdited || false,
    lastEditedAt: commentObj.lastEditedAt,
    createdAt: commentObj.createdAt,
    updatedAt: commentObj.updatedAt,
    mentions: commentObj.mentions || [],
    hashtags: commentObj.hashtags || []
  };

  // Add user-specific flags
  if (userId) {
    formatted.isLiked = commentObj.likedBy?.includes(userId) || false;
    formatted.isOwnComment = commentObj.author?._id?.toString() === userId.toString() || 
                            commentObj.author?.toString() === userId.toString();
  }

  // Add time ago
  formatted.timeAgo = getTimeAgo(commentObj.createdAt);

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
 * Build comment tree from flat list
 * @param {Array} comments - Flat list of comments
 * @returns {Array} - Nested comment tree
 */
export const buildCommentTree = (comments) => {
  const commentMap = {};
  const roots = [];

  // First pass: create map of comments by ID
  comments.forEach(comment => {
    commentMap[comment._id] = {
      ...comment.toObject(),
      replies: []
    };
  });

  // Second pass: build tree
  comments.forEach(comment => {
    const commentWithReplies = commentMap[comment._id];
    if (comment.parentComment && commentMap[comment.parentComment]) {
      // This is a reply
      commentMap[comment.parentComment].replies.push(commentWithReplies);
    } else {
      // This is a root comment
      roots.push(commentWithReplies);
    }
  });

  return roots;
};

/**
 * Sort comments based on option
 * @param {Array} comments - Array of comments
 * @param {string} sortBy - Sort option
 * @returns {Array} - Sorted comments
 */
export const sortComments = (comments, sortBy = 'newest') => {
  const sorted = [...comments];
  
  switch (sortBy) {
    case 'newest':
      return sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    case 'oldest':
      return sorted.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    
    case 'most_liked':
      return sorted.sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0));
    
    case 'most_replied':
      return sorted.sort((a, b) => (b.replyCount || 0) - (a.replyCount || 0));
    
    default:
      return sorted;
  }
};

// In comment.utils.js - Add this function
export const populateComment = (query, options = {}) => {
  const { 
    populateAuthor = true,
    populateLikedBy = true,
    populateMentions = true,
    populateReplies = false 
  } = options;

  if (populateAuthor) {
    query = query.populate('author', 'username displayName avatar');
  }
  
  if (populateLikedBy) {
    query = query.populate('likedBy', 'username');
  }
  
  if (populateMentions) {
    query = query.populate('mentions.user', 'username displayName');
  }
  
  if (populateReplies) {
    query = query.populate({
      path: 'replies',
      match: { isDeleted: false },
      populate: { path: 'author', select: 'username displayName avatar' }
    });
  }
  
  return query;
};