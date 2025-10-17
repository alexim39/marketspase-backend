
import mongoose from "mongoose";
import { NotificationService } from '../../notification/services/notification.service.js';

// Function to generate a unique 6-digit number
const generateUniqueUpi = () => {
  const min = 100000;
  const max = 999999;
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const promotionSchema = new mongoose.Schema({
  campaign: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Campaign",
    required: true,
  },
  promoter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "submitted", "validated", "rejected", "paid"],
    default: "pending",
  },
  submittedAt: Date,
  validatedAt: Date,
  paidAt: Date,
  proofMedia: [String], // URLs to proof screenshots
  proofViews: {
    type: Number,
    min: 0,
    validate: {
      validator: function(value) {
        // Only require proofViews when status is submitted or beyond
        return this.status === "pending" || value !== undefined;
      },
      message: "Proof views are required when promotion is submitted"
    }
  },
  payoutAmount: {
    type: Number,
    min: 0
  },
  rejectionReason: String,
  notes: String,
  isDownloaded: {
    type: Boolean,
    default: false,
  },
  upi: {
    type: String,
    unique: true,
    default: function() {
      // Ensure we're generating a new UPI only for new documents
      if (this.isNew) {
        return generateUniqueUpi().toString();
      }
      return this.upi;
    }
  },
  // Additional fields for better tracking
  validatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  paidBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  
  // Notification tracking fields
  notificationLog: [{
    type: {
      type: String,
      enum: [
        'promotion_pending',
        'promotion_submitted',
        'promotion_validated',
        'promotion_rejected',
        'submission_reminder',
        'payment_processed',
        'deadline_reminder',
        'promotion_apending'
      ],
      required: true
    },
    sentAt: {
      type: Date,
      default: Date.now
    },
    metadata: mongoose.Schema.Types.Mixed
  }],
  
  // Reminder tracking
  reminders: {
    submission: {
      lastSent: Date,
      sentCount: { type: Number, default: 0 }
    },
    validation: {
      lastSent: Date,
      sentCount: { type: Number, default: 0 }
    }
  },

  // Activity log for tracking changes
  activityLog: [{
    action: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    details: String,
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  }],
  submissionReminderSent: {
    type: Boolean,
    default: false
  }
}, { 
  timestamps: true,
  // Virtuals for toJSON and toObject
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index to prevent duplicate applications
promotionSchema.index({ campaign: 1, promoter: 1 }, { unique: true });

// Index for better query performance
promotionSchema.index({ status: 1 });
promotionSchema.index({ promoter: 1, status: 1 });
promotionSchema.index({ campaign: 1, status: 1 });
promotionSchema.index({ upi: 1 });
promotionSchema.index({ 'notificationLog.sentAt': 1 });
promotionSchema.index({ submittedAt: 1 });
promotionSchema.index({ 'reminders.submission.lastSent': 1 });

// Virtual for days since submission
promotionSchema.virtual('daysSinceSubmission').get(function() {
  if (!this.submittedAt) return null;
  const now = new Date();
  const diffTime = Math.abs(now - this.submittedAt);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for days since assignment
promotionSchema.virtual('daysSinceAssignment').get(function() {
  if (!this.createdAt) return null;
  const now = new Date();
  const diffTime = Math.abs(now - this.createdAt);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for isOverdue (if not validated within 7 days)
promotionSchema.virtual('isOverdue').get(function() {
  if (!this.submittedAt || this.status === 'validated' || this.status === 'rejected') {
    return false;
  }
  const now = new Date();
  const diffTime = Math.abs(now - this.submittedAt);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 7;
});

// Virtual for needsSubmissionReminder - Check if 23 hours have passed
promotionSchema.virtual('needsSubmissionReminder').get(function() {
  if (this.status !== 'pending') return false;
  
  const now = new Date();
  const assignmentTime = new Date(this.createdAt);
  const hoursSinceAssignment = (now - assignmentTime) / (1000 * 60 * 60);
  
  // Send reminder if assigned for exactly 23 hours (±1 hour tolerance)
  // and no reminder sent in the last 24 hours
  return hoursSinceAssignment >= 22 && hoursSinceAssignment <= 24 && 
         (!this.reminders.submission.lastSent || 
          (now - this.reminders.submission.lastSent) / (1000 * 60 * 60) > 24);
});

// Pre-save middleware to update timestamps based on status changes
promotionSchema.pre('save', async function(next) {
  if (this.isModified('status')) {
    const now = new Date();
    
    // Track if we need to send notifications (but don't save here)
    let shouldSendNotification = false;
    let notificationType = '';
    let notificationData = {};
    
    if (this.status === 'pending') {
      this.activityLog.push({
        action: 'Promotion Assigned',
        details: 'Promotion assigned to promoter',
        timestamp: now
      });

      // ✅ JUST SET FLAGS, DON'T SAVE OR SEND NOTIFICATIONS HERE
      shouldSendNotification = true;
      notificationType = 'promotion_assigned';
      
    } else if (this.status === 'submitted' && !this.submittedAt) {
      this.submittedAt = now;
      this.activityLog.push({
        action: 'Promotion Submitted',
        details: 'Promoter submitted proof for validation',
        timestamp: now
      });

      shouldSendNotification = true;
      notificationType = 'promotion_submitted';
      
    } else if (this.status === 'validated' && !this.validatedAt) {
      this.validatedAt = now;
      this.activityLog.push({
        action: 'Promotion Validated',
        details: 'Promotion validated and approved for payment',
        timestamp: now
      });

      shouldSendNotification = true;
      notificationType = 'promotion_validated';
      
    } else if (this.status === 'paid' && !this.paidAt) {
      this.paidAt = now;
      this.activityLog.push({
        action: 'Promotion Paid',
        details: 'Payment processed successfully',
        timestamp: now
      });

      shouldSendNotification = true;
      notificationType = 'payment_processed';
      
    } else if (this.status === 'rejected') {
      this.activityLog.push({
        action: 'Promotion Rejected',
        details: this.rejectionReason ? `Rejected: ${this.rejectionReason}` : 'Promotion rejected',
        timestamp: now
      });

      shouldSendNotification = true;
      notificationType = 'promotion_rejected';
    }
    
    // ✅ Store notification data for post-save handling
    if (shouldSendNotification) {
      this._pendingNotification = {
        type: notificationType,
        timestamp: now
      };
    }
  }
  next();
});

// Notification-related methods
promotionSchema.methods = {
  ...promotionSchema.methods,

  // Log a notification sent for this promotion
  async logNotification(notificationType, metadata = {}) {
    this.notificationLog.push({
      type: notificationType,
      metadata: metadata
    });
    return this.save();
  },

  // Check if a notification was recently sent
  wasNotificationRecentlySent(notificationType, hours = 24) {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    return this.notificationLog.some(notification => 
      notification.type === notificationType &&
      notification.sentAt > cutoffTime
    );
  },

  // Record submission reminder sent
  async recordSubmissionReminder() {
    this.reminders.submission.lastSent = new Date();
    this.reminders.submission.sentCount += 1;
    this.submissionReminderSent = true;
    await this.logNotification('submission_reminder', {
      reminderCount: this.reminders.submission.sentCount
    });
    return this.save();
  },

// Check if submission reminder should be sent - 23 hours after assignment
shouldSendSubmissionReminder() {
  if (this.status !== 'pending') return false;
  
  const now = new Date();
  const assignmentTime = new Date(this.createdAt);
  const hoursSinceAssignment = (now - assignmentTime) / (1000 * 60 * 60);
  
  // Send reminder if:
  // - Assigned for 23 hours (±1 hour tolerance)
  // - No reminder sent in last 24 hours
  // - Status is still pending
  return hoursSinceAssignment >= 22 && hoursSinceAssignment <= 24 && 
         (!this.reminders.submission.lastSent || 
          (now - this.reminders.submission.lastSent) / (1000 * 60 * 60) > 24) &&
         this.status === 'pending';
},

  // Record validation reminder sent (for campaign owners)
  async recordValidationReminder() {
    this.reminders.validation.lastSent = new Date();
    this.reminders.validation.sentCount += 1;
    return this.save();
  },

  // Get promotion summary for notifications
  getNotificationSummary() {
    return {
      promotionId: this._id,
      campaignId: this.campaign,
      promoterId: this.promoter,
      status: this.status,
      payoutAmount: this.payoutAmount,
      proofViews: this.proofViews,
      submittedAt: this.submittedAt,
      daysSinceSubmission: this.daysSinceSubmission
    };
  }
};

// Static methods for promotion notifications
promotionSchema.statics = {
  // Find promotions needing submission reminders (23 hours after assignment)
  async findPromotionsNeedingSubmissionReminders() {
    const twentyTwoHoursAgo = new Date(Date.now() - 22 * 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);
    
    return this.find({
      status: 'pending',
      createdAt: { 
        $gte: twentyFiveHoursAgo, 
        $lte: twentyTwoHoursAgo 
      },
      $or: [
        { 'reminders.submission.lastSent': { $lt: twentyFourHoursAgo } },
        { 'reminders.submission.lastSent': { $exists: false } }
      ]
    }).populate('promoter campaign');
  },

  // Find submitted promotions needing validation reminders
  async findPromotionsNeedingValidationReminders(daysThreshold = 3) {
    const thresholdDate = new Date(Date.now() - daysThreshold * 24 * 60 * 60 * 1000);
    
    return this.find({
      status: 'submitted',
      submittedAt: { $lt: thresholdDate },
      $or: [
        { 'reminders.validation.lastSent': { $lt: thresholdDate } },
        { 'reminders.validation.lastSent': { $exists: false } }
      ]
    }).populate('campaign');
  },

  // Find promotions by status with notification info
  async findByStatusWithNotifications(status) {
    return this.find({ status })
      .populate('promoter campaign')
      .select('+notificationLog +reminders');
  },

  // Get promoter's promotion statistics for notifications
  async getPromoterStats(promoterId) {
    const stats = await this.aggregate([
      { $match: { promoter: promoterId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalEarnings: { 
            $sum: { 
              $cond: ['$payoutAmount', '$payoutAmount', 0] 
            } 
          }
        }
      }
    ]);
    
    return stats.reduce((acc, stat) => {
      acc[stat._id] = {
        count: stat.count,
        earnings: stat.totalEarnings
      };
      return acc;
    }, {});
  }
};

// Instance method to validate promotion
promotionSchema.methods.validatePromotion = function(validatedByUserId) {
  this.status = 'validated';
  this.validatedAt = new Date();
  this.validatedBy = validatedByUserId;
  return this;
};

// Instance method to reject promotion
promotionSchema.methods.rejectPromotion = function(reason, rejectedByUserId) {
  this.status = 'rejected';
  this.rejectionReason = reason;
  this.activityLog.push({
    action: 'Promotion Rejected',
    details: reason,
    performedBy: rejectedByUserId,
    timestamp: new Date()
  });
  return this;
};

// Instance method to mark as paid
promotionSchema.methods.markAsPaid = function(paidByUserId) {
  this.status = 'paid';
  this.paidAt = new Date();
  this.paidBy = paidByUserId;
  return this;
};

// ✅ ADD POST-SAVE MIDDLEWARE FOR NOTIFICATIONS
promotionSchema.post('save', async function(doc) {
  // Handle pending notifications outside the save operation
  if (doc._pendingNotification) {
    const { type, timestamp } = doc._pendingNotification;
    
    try {
      const campaign = await mongoose.model('Campaign').findById(doc.campaign);
      if (campaign) {
        let notificationSent = false;
        
        switch (type) {
          case 'promotion_assigned':
            await NotificationService.createPromotionAssignedNotification(
              doc.promoter,
              campaign,
              doc
            );
            notificationSent = true;
            break;
            
          case 'promotion_submitted':
            await NotificationService.createPromotionSubmittedNotification(
              campaign.owner,
              doc,
              campaign
            );
            notificationSent = true;
            break;
            
          case 'promotion_validated':
            await NotificationService.createPromotionValidatedNotification(
              doc.promoter,
              doc,
              campaign
            );
            notificationSent = true;
            break;
            
          case 'payment_processed':
            await NotificationService.createPaymentProcessedNotification(
              doc.promoter,
              doc.payoutAmount,
              doc,
              'promoter'
            );
            notificationSent = true;
            break;
            
          case 'promotion_rejected':
            await NotificationService.createPromotionRejectedNotification(
              doc.promoter,
              doc,
              campaign,
              doc.rejectionReason
            );
            notificationSent = true;
            break;
        }
        
        // Log notification if sent successfully
        if (notificationSent) {
          // Use updateOne to avoid version conflicts
          await PromotionModel.updateOne(
            { _id: doc._id },
            { 
              $push: { 
                notificationLog: {
                  type: type,
                  sentAt: timestamp,
                  metadata: {
                    campaignId: campaign._id,
                    ...(type === 'promotion_submitted' && { proofViews: doc.proofViews }),
                    ...(type === 'promotion_validated' && { payoutAmount: doc.payoutAmount }),
                    ...(type === 'payment_processed' && { amount: doc.payoutAmount }),
                    ...(type === 'promotion_rejected' && { rejectionReason: doc.rejectionReason })
                  }
                }
              } 
            }
          );
        }
      }
    } catch (error) {
      console.error(`Error sending ${type} notification:`, error.message);
      // Don't fail the main operation if notification fails
    }
    
    // Clear the pending notification
    delete doc._pendingNotification;
  }
});

export const PromotionModel = mongoose.model("Promotion", promotionSchema);
