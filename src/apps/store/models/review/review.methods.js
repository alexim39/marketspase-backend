import { ERROR_MESSAGES, FLAG_THRESHOLD } from "./review.constants.js";
import { isHelpfulByUser, isReportedByUser } from "./review.utils.js";

export const setupReviewMethods = (schema) => {
  // Mark review as helpful
  schema.methods.markHelpful = async function(userId) {
    if (isHelpfulByUser(this.helpfulBy, userId)) {
      throw new Error(ERROR_MESSAGES.ALREADY_HELPFUL);
    }

    this.helpfulBy.push(userId);
    this.helpfulCount += 1;
    
    await this.save();
    return this;
  };

  // Unmark review as helpful
  schema.methods.unmarkHelpful = async function(userId) {
    const index = this.helpfulBy.findIndex(id => id.toString() === userId.toString());
    
    if (index === -1) {
      throw new Error(ERROR_MESSAGES.NOT_HELPFUL);
    }

    this.helpfulBy.splice(index, 1);
    this.helpfulCount = Math.max(0, this.helpfulCount - 1);
    
    await this.save();
    return this;
  };

  // Report review
  schema.methods.report = async function(userId, reason) {
    if (isReportedByUser(this.reportedBy, userId)) {
      throw new Error(ERROR_MESSAGES.ALREADY_REPORTED);
    }

    this.reportedBy.push({ user: userId, reason });
    this.reportCount += 1;
    
    // Auto-flag if too many reports
    if (this.reportCount >= FLAG_THRESHOLD) {
      this.status = 'flagged';
    }
    
    await this.save();
    return this;
  };

  // Add response to review (store owner/admin)
  schema.methods.addResponse = async function(content, respondedBy, responderName) {
    this.response = {
      content,
      createdAt: new Date(),
      respondedBy,
      responderName
    };
    
    await this.save();
    return this;
  };

  // Update response
  schema.methods.updateResponse = async function(content) {
    if (!this.response) {
      throw new Error('No response exists for this review');
    }

    this.response.content = content;
    this.response.createdAt = new Date(); // Update timestamp
    
    await this.save();
    return this;
  };

  // Delete response
  schema.methods.deleteResponse = async function() {
    this.response = undefined;
    await this.save();
    return this;
  };

  // Approve review (admin)
  schema.methods.approve = async function(moderatedBy, notes = '') {
    this.status = 'approved';
    this.moderatedBy = moderatedBy;
    this.moderatedAt = new Date();
    this.moderationNotes = notes;
    
    await this.save();
    return this;
  };

  // Reject review (admin)
  schema.methods.reject = async function(moderatedBy, notes = '') {
    this.status = 'rejected';
    this.moderatedBy = moderatedBy;
    this.moderatedAt = new Date();
    this.moderationNotes = notes;
    
    await this.save();
    return this;
  };

  // Clear flags (admin)
  schema.methods.clearFlags = async function(moderatedBy) {
    this.reportedBy = [];
    this.reportCount = 0;
    this.status = 'approved';
    this.moderatedBy = moderatedBy;
    this.moderatedAt = new Date();
    this.moderationNotes = 'Flags cleared by moderator';
    
    await this.save();
    return this;
  };

  // Toggle featured status (admin)
  schema.methods.toggleFeatured = async function() {
    this.isFeatured = !this.isFeatured;
    await this.save();
    return this;
  };

  // Update metadata
  schema.methods.updateMetadata = async function(metadata) {
    this.metadata = { ...this.metadata, ...metadata };
    await this.save();
    return this;
  };

  // Add image
  schema.methods.addImage = async function(url, caption = '') {
    this.images.push({ url, caption });
    await this.save();
    return this;
  };

  // Remove image
  schema.methods.removeImage = async function(imageUrl) {
    this.images = this.images.filter(img => img.url !== imageUrl);
    await this.save();
    return this;
  };

  // Check if user has interacted
  schema.methods.hasUserInteracted = function(userId) {
    return {
      helpful: isHelpfulByUser(this.helpfulBy, userId),
      reported: isReportedByUser(this.reportedBy, userId)
    };
  };

  // Get formatted response
  schema.methods.toResponse = function(userId = null) {
    const { formatReviewResponse } = require('./review.utils.js');
    return formatReviewResponse(this, userId);
  };
};