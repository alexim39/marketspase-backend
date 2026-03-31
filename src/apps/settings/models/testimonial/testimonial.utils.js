import { VALIDATION } from "./testimonial.constants.js";

/**
 * Validate testimonial message
 * @param {string} message - Testimonial message
 * @returns {Object} - Validation result
 */
export const validateMessage = (message) => {
  if (!message || message.trim().length === 0) {
    return {
      isValid: false,
      error: 'Message is required'
    };
  }

  const trimmedMessage = message.trim();
  
  if (trimmedMessage.length < VALIDATION.MESSAGE.MIN_LENGTH) {
    return {
      isValid: false,
      error: `Message must be at least ${VALIDATION.MESSAGE.MIN_LENGTH} characters`
    };
  }

  if (trimmedMessage.length > VALIDATION.MESSAGE.MAX_LENGTH) {
    return {
      isValid: false,
      error: `Message cannot exceed ${VALIDATION.MESSAGE.MAX_LENGTH} characters`
    };
  }

  return {
    isValid: true,
    message: trimmedMessage
  };
};

/**
 * Validate rating
 * @param {number} rating - Rating value
 * @returns {Object} - Validation result
 */
export const validateRating = (rating) => {
  if (rating === undefined || rating === null) {
    return {
      isValid: true,
      rating: 5 // Default rating
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
 * Check if user has reacted to testimonial
 * @param {Array} reactions - Array of reactions
 * @param {string} userId - User ID to check
 * @param {string} reactionType - Reaction type to check (optional)
 * @returns {Object} - Reaction info
 */
export const getUserReaction = (reactions, userId, reactionType = null) => {
  const reaction = reactions.find(r => 
    r.userId.toString() === userId.toString() && 
    (reactionType ? r.reaction === reactionType : true)
  );
  
  return reaction || null;
};

/**
 * Format testimonial for response
 * @param {Object} testimonial - Testimonial document
 * @param {string} userId - Current user ID for checking reactions
 * @returns {Object} - Formatted testimonial
 */
export const formatTestimonialResponse = (testimonial, userId = null) => {
  const testimonialObj = testimonial.toObject ? testimonial.toObject() : testimonial;
  
  const formatted = {
    id: testimonialObj._id,
    user: testimonialObj.user,
    message: testimonialObj.message,
    status: testimonialObj.status,
    likes: testimonialObj.likes || 0,
    dislikes: testimonialObj.dislikes || 0,
    isFeatured: testimonialObj.isFeatured || false,
    rating: testimonialObj.rating || 5,
    createdAt: testimonialObj.createdAt,
    updatedAt: testimonialObj.updatedAt
  };

  // Add user-specific flags
  if (userId) {
    const userReaction = getUserReaction(testimonialObj.reactions || [], userId);
    formatted.userReaction = userReaction ? userReaction.reaction : null;
    formatted.isOwnTestimonial = testimonialObj.user?._id?.toString() === userId.toString() || 
                                 testimonialObj.user?.toString() === userId.toString();
  }

  // Add time ago
  formatted.timeAgo = getTimeAgo(testimonialObj.createdAt);

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
 * Calculate sentiment score based on rating and reactions
 * @param {Object} testimonial - Testimonial object
 * @returns {number} - Sentiment score (-1 to 1)
 */
export const calculateSentimentScore = (testimonial) => {
  const ratingScore = (testimonial.rating - 3) / 2; // Convert 1-5 to -1 to 1
  const totalReactions = testimonial.likes + testimonial.dislikes;
  
  let reactionScore = 0;
  if (totalReactions > 0) {
    reactionScore = (testimonial.likes - testimonial.dislikes) / totalReactions;
  }
  
  // Weighted average (70% rating, 30% reactions)
  return (ratingScore * 0.7) + (reactionScore * 0.3);
};