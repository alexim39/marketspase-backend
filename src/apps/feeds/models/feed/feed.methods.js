import { formatCommentResponse } from "./feed.utils.js";
import { ERROR_MESSAGES } from "./feed.constants.js";

export const setupFeedMethods = (schema) => {
  // Check if user liked post
  schema.methods.isLikedBy = function(userId) {
    return this.likes.some(like => like.user.toString() === userId.toString());
  };

  // Check if user saved post
  schema.methods.isSavedBy = function(userId) {
    return this.savedBy.some(saved => saved.user.toString() === userId.toString());
  };

  // Check if user viewed post
  schema.methods.isViewedBy = function(userId) {
    return this.reach?.uniqueViews?.includes(userId) || false;
  };

  // Add like
  schema.methods.addLike = async function(userId) {
    if (this.isLikedBy(userId)) {
      throw new Error(ERROR_MESSAGES.ALREADY_LIKED);
    }
    
    this.likes.push({ user: userId });
    return this.save();
  };

  // Remove like
  schema.methods.removeLike = async function(userId) {
    if (!this.isLikedBy(userId)) {
      throw new Error(ERROR_MESSAGES.NOT_LIKED);
    }
    
    this.likes = this.likes.filter(like => like.user.toString() !== userId.toString());
    return this.save();
  };

  // Add save/bookmark
  schema.methods.addSave = async function(userId) {
    if (this.isSavedBy(userId)) {
      throw new Error(ERROR_MESSAGES.ALREADY_SAVED);
    }
    
    this.savedBy.push({ user: userId });
    return this.save();
  };

  // Remove save/bookmark
  schema.methods.removeSave = async function(userId) {
    if (!this.isSavedBy(userId)) {
      throw new Error(ERROR_MESSAGES.NOT_SAVED);
    }
    
    this.savedBy = this.savedBy.filter(saved => saved.user.toString() !== userId.toString());
    return this.save();
  };

  // Add impression/view
  schema.methods.addImpression = async function(userId) {
    this.reach.impressions += 1;
    
    if (userId && !this.isViewedBy(userId)) {
      this.reach.uniqueViews.push(userId);
    }
    
    this.reach.lastImpressionAt = new Date();
    return this.save();
  };

  // Add comment
  schema.methods.addComment = async function(userId, content) {
    const comment = {
      user: userId,
      content,
      likes: [],
      replies: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.comments.push(comment);
    await this.save();
    
    return comment;
  };

  // Update comment
  schema.methods.updateComment = async function(commentId, userId, content) {
    const comment = this.comments.id(commentId);
    
    if (!comment) {
      throw new Error(ERROR_MESSAGES.COMMENT_NOT_FOUND);
    }
    
    if (comment.user.toString() !== userId.toString()) {
      throw new Error(ERROR_MESSAGES.UNAUTHORIZED);
    }
    
    comment.content = content;
    comment.updatedAt = new Date();
    
    await this.save();
    return comment;
  };

  // Delete comment
  schema.methods.deleteComment = async function(commentId, userId) {
    const comment = this.comments.id(commentId);
    
    if (!comment) {
      throw new Error(ERROR_MESSAGES.COMMENT_NOT_FOUND);
    }
    
    if (comment.user.toString() !== userId.toString()) {
      throw new Error(ERROR_MESSAGES.UNAUTHORIZED);
    }
    
    comment.remove();
    await this.save();
    
    return true;
  };

  // Like comment
  schema.methods.likeComment = async function(commentId, userId) {
    const comment = this.comments.id(commentId);
    
    if (!comment) {
      throw new Error(ERROR_MESSAGES.COMMENT_NOT_FOUND);
    }
    
    if (comment.likes.includes(userId)) {
      comment.likes = comment.likes.filter(id => id.toString() !== userId.toString());
    } else {
      comment.likes.push(userId);
    }
    
    await this.save();
    return formatCommentResponse(comment, userId);
  };

  // Add reply to comment
  schema.methods.addReply = async function(commentId, userId, content) {
    const comment = this.comments.id(commentId);
    
    if (!comment) {
      throw new Error(ERROR_MESSAGES.COMMENT_NOT_FOUND);
    }
    
    const reply = {
      user: userId,
      content,
      likes: [],
      createdAt: new Date()
    };
    
    comment.replies.push(reply);
    await this.save();
    
    return reply;
  };

  // Delete reply
  schema.methods.deleteReply = async function(commentId, replyId, userId) {
    const comment = this.comments.id(commentId);
    
    if (!comment) {
      throw new Error(ERROR_MESSAGES.COMMENT_NOT_FOUND);
    }
    
    const reply = comment.replies.id(replyId);
    
    if (!reply) {
      throw new Error(ERROR_MESSAGES.REPLY_NOT_FOUND);
    }
    
    if (reply.user.toString() !== userId.toString()) {
      throw new Error(ERROR_MESSAGES.UNAUTHORIZED);
    }
    
    reply.remove();
    await this.save();
    
    return true;
  };

  // Add share
  schema.methods.addShare = async function(userId, platform) {
    this.shares.push({
      user: userId,
      platform
    });
    
    return this.save();
  };

  // Flag for moderation
  schema.methods.flag = async function(userId, reason) {
    if (!this.moderation.flaggedBy.includes(userId)) {
      this.moderation.flaggedBy.push(userId);
    }
    
    this.moderation.isFlagged = true;
    this.moderation.flagReason = reason || this.moderation.flagReason;
    
    return this.save();
  };

  // Moderate post
  schema.methods.moderate = async function(moderatorId, action, notes) {
    this.moderation.reviewedBy = moderatorId;
    this.moderation.reviewedAt = new Date();
    this.moderation.reviewNotes = notes;
    
    if (action === 'approve') {
      this.moderation.isFlagged = false;
      this.status = 'published';
    } else if (action === 'remove') {
      this.status = 'archived';
    }
    
    return this.save();
  };

  // Feature post
  schema.methods.feature = async function(adminId, days = 7) {
    this.isFeatured = true;
    this.featuredBy = adminId;
    this.featuredUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    
    return this.save();
  };

  // Unfeature post
  schema.methods.unfeature = async function() {
    this.isFeatured = false;
    this.featuredUntil = null;
    
    return this.save();
  };

  // Archive post
  schema.methods.archive = async function(userId) {
    if (this.author.toString() !== userId.toString()) {
      throw new Error(ERROR_MESSAGES.UNAUTHORIZED);
    }
    
    this.status = 'archived';
    return this.save();
  };

  // Get formatted response
  schema.methods.toResponse = function(userId = null) {
    const { formatPostResponse } = require('./feed.utils.js');
    return formatPostResponse(this, userId);
  };
};