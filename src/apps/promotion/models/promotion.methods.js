import { createActivityEntry } from "./promotion.utils.js";

export const setupPromotionMethods = (schema) => {
  // Add activity to log
  schema.methods.addActivity = function(action, details = '', performedBy = null) {
    this.activityLog.push(createActivityEntry(action, details, performedBy));
    return this;
  };

  // Mark as downloaded
  schema.methods.markAsDownloaded = function() {
    if (this.status !== 'accepted') {
      throw new Error('Promotion must be accepted before downloading');
    }
    
    this.status = 'downloaded';
    this.downloadedAt = new Date();
    this.isDownloaded = true;
    this.addActivity('Promotion Downloaded');
    
    return this.save();
  };

  // Submit promotion with proof
  schema.methods.submit = function(proofMedia, proofViews) {
    if (this.status !== 'downloaded') {
      throw new Error('Promotion must be downloaded before submission');
    }
    
    this.status = 'submitted';
    this.submittedAt = new Date();
    this.proofMedia = proofMedia;
    this.proofViews = proofViews;
    this.addActivity('Promotion Submitted');
    
    return this.save();
  };

  // Mark a submitted promotion as validated
  schema.methods.markAsValidated = function(validatedBy, viewsUsedForPayout = null) {
    if (this.status !== 'submitted') {
      throw new Error('Only submitted promotions can be validated');
    }
    
    this.status = 'validated';
    this.validatedAt = new Date();
    this.validatedBy = validatedBy;
    this.viewsUsedForPayout = viewsUsedForPayout || this.proofViews;
    this.addActivity('Promotion Validated', `Validated by ${validatedBy}`, validatedBy);
    
    return this.save();
  };

  // Reject promotion
  schema.methods.reject = function(rejectionReason, rejectedBy) {
    if (!['submitted', 'validated'].includes(this.status)) {
      throw new Error('Only submitted or validated promotions can be rejected');
    }
    
    this.status = 'rejected';
    this.rejectedAt = new Date();
    this.rejectionReason = rejectionReason;
    this.addActivity('Promotion Rejected', rejectionReason, rejectedBy);
    
    return this.save();
  };

  // Mark as paid
  schema.methods.markAsPaid = function(paidBy, payoutAmount) {
    if (this.hasBeenPaid) {
      return this; // Idempotent
    }
    
    if (this.status !== 'validated') {
      throw new Error('Promotion must be validated before payment');
    }
    
    this.status = 'paid';
    this.paidAt = new Date();
    this.paidBy = paidBy;
    this.payoutAmount = payoutAmount || this.payoutAmount;
    this.hasBeenPaid = true;
    this.addActivity('Promotion Paid', `Paid ${payoutAmount}`, paidBy);
    
    return this.save();
  };

  // Check if notification already sent
  schema.methods.hasNotificationBeenSent = function(notificationType) {
    return this.notificationLog.some(log => log.type === notificationType);
  };

  // Update reminder tracking
  schema.methods.trackReminder = function(reminderType) {
    if (!this.reminders[reminderType]) return;
    
    this.reminders[reminderType].lastSent = new Date();
    this.reminders[reminderType].sentCount += 1;
    
    return this.save();
  };

  // Get promotion timeline
  schema.methods.getTimeline = function() {
    return {
      accepted: this.acceptedAt,
      downloaded: this.downloadedAt,
      submitted: this.submittedAt,
      validated: this.validatedAt,
      rejected: this.rejectedAt,
      paid: this.paidAt
    };
  };

  // Check if can transition to a status
  schema.methods.canTransitionTo = function(newStatus) {
    const validTransitions = {
      'accepted': ['downloaded'],
      'downloaded': ['submitted'],
      'submitted': ['validated', 'rejected'],
      'validated': ['paid', 'rejected'],
      'paid': [],
      'rejected': []
    };
    
    return validTransitions[this.status]?.includes(newStatus) || false;
  };
};
