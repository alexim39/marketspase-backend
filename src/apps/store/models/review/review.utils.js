import { VALIDATION } from "./review.constants.js";

/**
 * Validate rating
 * @param {number} rating - Rating value
 * @returns {Object} - Validation result
 */
export const validateRating = (rating) => {
  if (rating === undefined || rating === null) {
    return {
      isValid: false,
      error: 'Rating is required'
    };
  }

  if (rating < VALIDATION.RATING.MIN || rating > VALIDATION.RATING.MAX) {
    return {
      isValid: false,
      error: `Rating must be between ${VALIDATION.RATING.MIN} and ${VALIDATION.RATING.MAX}`
    };
  }

  return {
    isValid: true,
    rating
  };
};

/**
 * Validate comment
 * @param {string} comment - Review comment
 * @returns {Object} - Validation result
 */
export const validateComment = (comment) => {
  if (!comment || comment.trim().length === 0) {
    return {
      isValid: false,
      error: 'Comment is required'
    };
  }

  const trimmedComment = comment.trim();
  
  if (trimmedComment.length < VALIDATION.COMMENT.MIN_LENGTH) {
    return {
      isValid: false,
      error: `Comment must be at least ${VALIDATION.COMMENT.MIN_LENGTH} characters`
    };
  }

  if (trimmedComment.length > VALIDATION.COMMENT.MAX_LENGTH) {
    return {
      isValid: false,
      error: `Comment cannot exceed ${VALIDATION.COMMENT.MAX_LENGTH} characters`
    };
  }

  return {
    isValid: true,
    comment: trimmedComment
  };
};

/**
 * Validate title
 * @param {string} title - Review title
 * @returns {Object} - Validation result
 */
export const validateTitle = (title) => {
  if (!title) {
    return { isValid: true, title: '' };
  }

  const trimmedTitle = title.trim();
  
  if (trimmedTitle.length > VALIDATION.TITLE.MAX_LENGTH) {
    return {
      isValid: false,
      error: `Title cannot exceed ${VALIDATION.TITLE.MAX_LENGTH} characters`
    };
  }

  return {
    isValid: true,
    title: trimmedTitle
  };
};

/**
 * Check if user has marked review as helpful
 * @param {Array} helpfulBy - Array of user IDs
 * @param {string} userId - User ID to check
 * @returns {boolean} - True if user has marked as helpful
 */
export const isHelpfulByUser = (helpfulBy, userId) => {
  return helpfulBy.some(id => id.toString() === userId.toString());
};

/**
 * Check if user has reported review
 * @param {Array} reportedBy - Array of report objects
 * @param {string} userId - User ID to check
 * @returns {boolean} - True if user has reported
 */
export const isReportedByUser = (reportedBy, userId) => {
  return reportedBy.some(r => r.user.toString() === userId.toString());
};

/**
 * Format review for response
 * @param {Object} review - Review document
 * @param {string} userId - Current user ID for checking interactions
 * @returns {Object} - Formatted review
 */
export const formatReviewResponse = (review, userId = null) => {
  const reviewObj = review.toObject ? review.toObject() : review;
  
  const formatted = {
    id: reviewObj._id,
    productId: reviewObj.productId,
    userId: reviewObj.userId,
    storeId: reviewObj.storeId,
    rating: reviewObj.rating,
    title: reviewObj.title,
    comment: reviewObj.comment,
    images: reviewObj.images || [],
    verifiedPurchase: reviewObj.verifiedPurchase || false,
    variantName: reviewObj.variantName,
    helpfulCount: reviewObj.helpfulCount || 0,
    reportCount: reviewObj.reportCount || 0,
    status: reviewObj.status,
    isFeatured: reviewObj.isFeatured || false,
    response: reviewObj.response,
    createdAt: reviewObj.createdAt,
    updatedAt: reviewObj.updatedAt
  };

  // Add user-specific flags
  if (userId) {
    formatted.isHelpfulByCurrentUser = isHelpfulByUser(reviewObj.helpfulBy || [], userId);
    formatted.isReportedByCurrentUser = isReportedByUser(reviewObj.reportedBy || [], userId);
    formatted.isOwnReview = reviewObj.userId?.toString() === userId.toString();
  }

  // Add time ago
  formatted.timeAgo = getTimeAgo(reviewObj.createdAt);

  // Add helpful percentage
  if (reviewObj.helpfulCount > 0 || reviewObj.reportCount > 0) {
    const total = reviewObj.helpfulCount + reviewObj.reportCount;
    formatted.helpfulPercentage = total > 0 ? (reviewObj.helpfulCount / total) * 100 : 0;
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
 * Calculate average rating from array of ratings
 * @param {Array} ratings - Array of rating objects
 * @returns {number} - Average rating
 */
export const calculateAverageRating = (ratings) => {
  if (!ratings || ratings.length === 0) return 0;
  
  const sum = ratings.reduce((acc, curr) => acc + curr.rating, 0);
  return sum / ratings.length;
};

/**
 * Get rating breakdown from array of reviews
 * @param {Array} reviews - Array of review objects
 * @returns {Object} - Rating breakdown
 */
export const getRatingBreakdown = (reviews) => {
  const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  
  reviews.forEach(review => {
    if (review.rating >= 1 && review.rating <= 5) {
      breakdown[review.rating] += 1;
    }
  });
  
  return breakdown;
};