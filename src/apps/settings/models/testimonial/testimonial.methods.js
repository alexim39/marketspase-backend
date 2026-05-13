import { ERROR_MESSAGES, REACTION_TYPE, TESTIMONIAL_STATUS } from "./testimonial.constants.js";
import { formatTestimonialResponse, getUserReaction, validateMessage, validateRating } from "./testimonial.utils.js";

export const setupTestimonialMethods = (schema) => {
  // Check if user has reacted
  schema.methods.hasUserReacted = function(userId, reactionType = null) {
    return !!getUserReaction(this.reactions, userId, reactionType);
  };

  // Add reaction (like/dislike)
  schema.methods.addReaction = async function(userId, reactionType) {
    if (this.hasUserReacted(userId)) {
      throw new Error(ERROR_MESSAGES.ALREADY_REACTED);
    }

    if (!Object.values(REACTION_TYPE).includes(reactionType)) {
      throw new Error(ERROR_MESSAGES.INVALID_REACTION);
    }

    // Add reaction
    this.reactions.push({
      userId,
      reaction: reactionType,
      createdAt: new Date()
    });

    // Update counts
    if (reactionType === REACTION_TYPE.LIKE) {
      this.likes += 1;
    } else {
      this.dislikes += 1;
    }

    await this.save();
    return this;
  };

  // Remove reaction
  schema.methods.removeReaction = async function(userId) {
    const reaction = getUserReaction(this.reactions, userId);
    
    if (!reaction) {
      throw new Error(ERROR_MESSAGES.REACTION_NOT_FOUND);
    }

    // Update counts before removing
    if (reaction.reaction === REACTION_TYPE.LIKE) {
      this.likes = Math.max(0, this.likes - 1);
    } else {
      this.dislikes = Math.max(0, this.dislikes - 1);
    }

    // Remove reaction
    this.reactions = this.reactions.filter(
      r => r.userId.toString() !== userId.toString()
    );

    await this.save();
    return this;
  };

  // Toggle reaction (add if not exists, remove if exists)
  schema.methods.toggleReaction = async function(userId, reactionType) {
    if (this.hasUserReacted(userId)) {
      return this.removeReaction(userId);
    } else {
      return this.addReaction(userId, reactionType);
    }
  };

  // Update testimonial message
  schema.methods.updateMessage = async function(newMessage, userId) {
    if (this.status === TESTIMONIAL_STATUS.APPROVED) {
      throw new Error(ERROR_MESSAGES.CANNOT_MODIFY_APPROVED);
    }

    const validation = validateMessage(newMessage);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    this.message = validation.message;
    await this.save();
    return this;
  };

  // Update rating
  schema.methods.updateRating = async function(newRating) {
    const validation = validateRating(newRating);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    this.rating = validation.rating;
    await this.save();
    return this;
  };

  // Approve testimonial (admin)
  schema.methods.approve = async function(reviewedBy, notes = '') {
    this.status = TESTIMONIAL_STATUS.APPROVED;
    this.reviewedBy = reviewedBy;
    this.reviewedAt = new Date();
    this.reviewNotes = notes;
    
    await this.save();
    return this;
  };

  // Reject testimonial (admin)
  schema.methods.reject = async function(reviewedBy, notes = '') {
    this.status = TESTIMONIAL_STATUS.REJECTED;
    this.reviewedBy = reviewedBy;
    this.reviewedAt = new Date();
    this.reviewNotes = notes;
    
    await this.save();
    return this;
  };

  // Toggle featured status (admin)
  schema.methods.toggleFeatured = async function() {
    if (this.status !== TESTIMONIAL_STATUS.APPROVED) {
      throw new Error('Only approved testimonials can be featured');
    }
    
    this.isFeatured = !this.isFeatured;
    await this.save();
    return this;
  };

  // Soft delete
  schema.methods.softDelete = async function() {
    this.isDeleted = true;
    this.deletedAt = new Date();
    await this.save();
    return this;
  };

  // Restore soft-deleted testimonial
  schema.methods.restore = async function() {
    this.isDeleted = false;
    this.deletedAt = null;
    await this.save();
    return this;
  };

  // Get user's reaction to this testimonial
  schema.methods.getUserReaction = function(userId) {
    return getUserReaction(this.reactions, userId);
  };

  // Get formatted response
  schema.methods.toResponse = function(userId = null) {
    return formatTestimonialResponse(this, userId);
  };

  // Get summary
  schema.methods.getSummary = function() {
    return {
      id: this._id,
      user: this.user,
      excerpt: this.excerpt,
      rating: this.rating,
      likes: this.likes,
      dislikes: this.dislikes,
      status: this.status,
      isFeatured: this.isFeatured,
      createdAt: this.createdAt,
      timeAgo: this.timeAgo,
      sentiment: this.sentiment
    };
  };
};
