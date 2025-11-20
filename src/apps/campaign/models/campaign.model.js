import mongoose from "mongoose";

const campaignSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: { type: String, required: true },

    // WhatsApp status content
    //mediaUrl: { type: String }, // Media is required for a campaign
    mediaUrl: { type: String, required: true }, // Media is required for a campaign
    caption: { type: String },
    link: { type: String }, // optional CTA link
    category: { type: String, required: true },
    // mediaType: { type: String, required: true, default: "image" },
    mediaType: { type: String, enum: ['image', 'video'], required: true },
    thumbnailUrl: { type: String },

    // Budgeting
    budget: { type: Number, required: true, min: 500 }, // Updated min to 500 NGN
    payoutPerPromotion: { type: Number, required: true, min: 200 },
    currency: { type: String, default: "NGN" },

    // Promotion & Tracking
    maxPromoters: { type: Number, required: true, min: 1 }, 
    currentPromoters: { type: Number, required: true, min: 0, default: 0 },
    //minViewsPerPromotion: { type: Number, required: true, min: 40, default: 40 },
    minViewsPerPromotion: { 
      type: Number, 
      required: true, 
      min: 40, 
      default: 40,
      validate: {
        validator: function(value) {
          // Allow existing campaigns with 25, but new ones must be ≥40
          return value >= 25;
        },
        message: 'minViewsPerPromotion must be at least 25 for existing campaigns'
      }
    },
    totalPromotions: { type: Number, default: 0 },
    validatedPromotions: { type: Number, default: 0 },
    paidPromotions: { type: Number, default: 0 },
    spentBudget: { type: Number, default: 0 },
    
    // Targeting & Requirements
    enableTarget: { type: Boolean, default: false },
    //targetLocations: [{ type: String }],
    targetLocations: [{
      id: { type: String, required: true },
      name: { type: String, required: true },
      type: { type: String, required: true },
      place_id: { type: String, required: true },
      coordinates: {
        lat: { type: Number, default: 0 },
        lng: { type: Number, default: 0 }
      },
      precision: { type: String, default: "medium" }
    }],
    requirements: [{ type: String }],
    minRating: { type: Number, default: 0, min: 0, max: 5 },
    
    // Campaign Type & Priority
    campaignType: { 
      type: String, 
      enum: ["standard", "premium", "boost"], 
      default: "standard" 
    },
    priority: { 
      type: String, 
      enum: ["low", "medium", "high"], 
      default: "low" 
    },
    
    // Campaign timeline
    startDate: { type: Date, required: true, default: Date.now },
    endDate: { type: Date },
    hasEndDate: { type: Boolean, default: true },
    
    // Status
    status: {
      type: String,
      enum: ["active", "paused", "rejected", "completed", "exhausted", "expired", "pending", "draft", "archived"],
      default: "pending",
    },

    // Notification tracking fields
    notificationLog: [{
      type: {
        type: String,
        enum: [
          'campaign_approved',
          'campaign_rejected', 
          'budget_exhausted',
          'submission_reminder',
          'promotion_assigned',
          'promotion_submitted',
          'promotion_validated',
          'promotion_rejected',
          'low_balance',
          'payment_processed',
          'deadline_reminder',
          'promotion_apending',
        ],
        required: true
      },
      sentTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
      },
      sentAt: {
        type: Date,
        default: Date.now
      },
      metadata: mongoose.Schema.Types.Mixed
    }],

    // Budget alert thresholds
    budgetAlerts: {
      sentAt: [Date], // Track when budget alerts were sent
      lastAlertPercentage: { type: Number, default: 0 } // Track last alert percentage
    },

    // Submission reminder tracking
    submissionReminders: {
      lastSent: Date,
      sentCount: { type: Number, default: 0 }
    },

    // Campaign deletion
    isDeleted: {
      type: Boolean,
      default: false
    },
    deletedAt: Date,
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    
    // Additional fields
    difficulty: { 
      type: String, 
      enum: ["easy", "medium", "hard"], 
      default: "medium" 
    },
    tags: [{ type: String }],
    estimatedViews: { type: Number, default: 0 },
    duration: { type: String },
    
    // A log for campaign actions
    activityLog: [
      {
        action: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        details: { type: String },
        performedBy: { 
          type: mongoose.Schema.Types.ObjectId, 
          ref: "User" 
        },
      },
    ],
    
    // Audit fields
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  },
  { timestamps: true }
);

// Index for better query performance
//campaignSchema.index({ owner: 1, status: 1 });
campaignSchema.index({ category: 1, status: 1 });
campaignSchema.index({ startDate: 1, endDate: 1 });
campaignSchema.index({ status: 1, priority: -1 });
campaignSchema.index({ 'notificationLog.sentAt': 1 });
campaignSchema.index({ spentBudget: 1, budget: 1 });

// Pre-save middleware to update spendBudget
// campaignSchema.pre('save', function(next) {
//   this.spentBudget = (this.payoutPerPromotion * this.paidPromotions) || 0;
//   next();
// })

campaignSchema.virtual('calculatedSpentBudget').get(function() {
  return (this.payoutPerPromotion * this.paidPromotions) || 0;
});

// Virtual for remaining budget
campaignSchema.virtual('remainingBudget').get(function() {
  return this.budget - this.spentBudget;
});

// Virtual for budget utilization percentage
campaignSchema.virtual('budgetUtilization').get(function() {
  if (this.budget === 0) return 0;
  return (this.spentBudget / this.budget) * 100;
});

// Virtual for progress percentage
campaignSchema.virtual('progress').get(function() {
  if (this.maxPromoters === 0) return 0;
  return (this.currentPromoters / this.maxPromoters) * 100;
});

// Virtual for remaining days
campaignSchema.virtual('remainingDays').get(function() {
  if (!this.endDate || !this.hasEndDate) return 'No End Date';
  
  const now = new Date();
  const end = new Date(this.endDate);
  const diffTime = end.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return 'Expired';
  if (this.status === 'exhausted') return 'Budget Exhausted';
  return diffDays;
});

// Helper method to check if a promoter can be assigned
campaignSchema.methods.canAssignPromoter = function() {
  const potentialSpend = this.spentBudget + this.payoutPerPromotion;
  return (
    this.status === "active" && 
    this.totalPromotions < this.maxPromoters && 
    potentialSpend <= this.budget
  );
};

// Method to assign a promoter
campaignSchema.methods.assignPromoter = function () {
  if (!this.canAssignPromoter()) {
    throw new Error('Cannot assign promoter - campaign is full or budget exhausted');
  }

  this.totalPromotions += 1;
  this.currentPromoters += 1;

  // Add to activity log
  this.activityLog.push({
    action: "Promoter Assigned",
    details: `New promoter assigned. Total promoters: ${this.totalPromotions}`,
    timestamp: new Date()
  });

  return this;
};

// Method to record payment to a promoter
campaignSchema.methods.recordPromoterPayment = function (amount) {
  this.paidPromotions += 1;
  this.spentBudget += amount;
  
  // Check if budget is exhausted
  if (this.spentBudget >= this.budget) {
    this.status = "exhausted";
  }
  
  // Add to activity log
  this.activityLog.push({
    action: "Promoter Paid",
    details: `Promoter paid ${amount} ${this.currency}. Total paid: ${this.paidPromotions}`,
    timestamp: new Date()
  });

  return this;
};

// Method to validate a promotion
campaignSchema.methods.validatePromotion = function () {
  this.validatedPromotions += 1;
  
  // Add to activity log
  this.activityLog.push({
    action: "Promotion Validated",
    details: `Promotion validated. Total validated: ${this.validatedPromotions}`,
    timestamp: new Date()
  });

  return this;
};

// Method to update campaign status
campaignSchema.methods.updateStatus = function(newStatus, performedBy, details = "") {
  const oldStatus = this.status;
  this.status = newStatus;
  
  this.activityLog.push({
    action: "Status Changed",
    details: `Status changed from ${oldStatus} to ${newStatus}. ${details}`,
    timestamp: new Date(),
    performedBy: performedBy
  });
  
  return this;
};

// Notification-related methods
campaignSchema.methods = {
  ...campaignSchema.methods,

  // Log a notification sent for this campaign
  logNotification(notificationType, sentTo, metadata = {}) {
    this.notificationLog.push({
      type: notificationType,
      sentTo: sentTo,
      metadata: metadata
    });
    
    // Add to activity log
    this.activityLog.push({
      action: "Notification Sent",
      details: `${notificationType} notification sent to user`,
      timestamp: new Date()
    });
    
    return this.save();
  },

  // Check if a notification was recently sent (avoid duplicates)
  wasNotificationRecentlySent(notificationType, userId, hours = 24) {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    return this.notificationLog.some(notification => 
      notification.type === notificationType &&
      notification.sentTo.toString() === userId.toString() &&
      notification.sentAt > cutoffTime
    );
  },

  // Check if budget alert should be sent
  shouldSendBudgetAlert(thresholdPercentage = 80) {
    const utilization = this.budgetUtilization;
    
    // Don't send if already exhausted
    if (this.status === 'exhausted') return false;
    
    // Check if we've crossed the threshold and haven't alerted for this threshold
    if (utilization >= thresholdPercentage && 
        this.budgetAlerts.lastAlertPercentage < thresholdPercentage) {
      return true;
    }
    
    return false;
  },

  // Record budget alert sent
  recordBudgetAlert(percentage) {
    this.budgetAlerts.sentAt.push(new Date());
    this.budgetAlerts.lastAlertPercentage = percentage;
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

  // Record submission reminder sent
  recordSubmissionReminder() {
    this.submissionReminders.lastSent = new Date();
    this.submissionReminders.sentCount += 1;
    return this.save();
  },

  // Get campaign performance for notification summaries
  getPerformanceSummary() {
    return {
      totalPromotions: this.totalPromotions,
      validatedPromotions: this.validatedPromotions,
      paidPromotions: this.paidPromotions,
      spentBudget: this.spentBudget,
      remainingBudget: this.remainingBudget,
      progress: this.progress,
      estimatedViews: this.estimatedViews
    };
  }
};

// Static methods for campaign notifications
campaignSchema.statics = {
  // Find campaigns that need budget alerts
  async findCampaignsNeedingBudgetAlerts(thresholdPercentage = 80) {
    return this.find({
      status: 'active',
      $expr: {
        $and: [
          { $gte: [{ $multiply: [{ $divide: ['$spentBudget', '$budget'] }, 100] }, thresholdPercentage] },
          { $lt: ['$budgetAlerts.lastAlertPercentage', thresholdPercentage] }
        ]
      }
    }).populate('owner');
  },

  // Find active campaigns with pending submissions
  async findCampaignsWithPendingSubmissions() {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    return this.find({
      status: 'active',
      $or: [
        { 'submissionReminders.lastSent': { $lt: twentyFourHoursAgo } },
        { 'submissionReminders.lastSent': { $exists: false } }
      ],
      totalPromotions: { $gt: 0 }
    });
  },

  // Find campaigns approaching deadline (for reminder notifications)
  async findCampaignsApproachingDeadline(daysThreshold = 3) {
    const thresholdDate = new Date(Date.now() + daysThreshold * 24 * 60 * 60 * 1000);
    
    return this.find({
      status: 'active',
      hasEndDate: true,
      endDate: { $lte: thresholdDate, $gte: new Date() }
    }).populate('owner');
  },

  // Find campaigns that need status update notifications
  async findCampaignsForStatusNotifications() {
    return this.find({
      status: { $in: ['pending', 'rejected', 'approved'] },
      'notificationLog.type': { $ne: `campaign_${this.status}` }
    }).populate('owner');
  }
};

// Virtual for promotions
campaignSchema.virtual('promotions', {
  ref: 'Promotion',
  localField: '_id',
  foreignField: 'campaign'
});

campaignSchema.set('toObject', { virtuals: true });
campaignSchema.set('toJSON', { virtuals: true });

// Pre-save middleware to update estimated views
campaignSchema.pre('save', function(next) {
  if (this.isModified('maxPromoters') || this.isNew) {
    // Estimate 35 views per promoter on average
    this.estimatedViews = this.maxPromoters * 35;
  }
  
  // Set duration text
  if (this.startDate && this.endDate && this.hasEndDate) {
    const start = new Date(this.startDate);
    const end = new Date(this.endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    this.duration = `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
  } else {
    this.duration = 'Ongoing';
  }
  
  next();
});

// Post-save middleware to handle budget exhaustion notifications
campaignSchema.post('save', async function(doc) {
  // Check if budget just got exhausted
  if (doc.status === 'exhausted' && doc.$isNew !== true) {
    try {
      const Campaign = mongoose.model('Campaign');
      const previousDoc = await Campaign.findById(doc._id);
      
      // If status changed to exhausted, trigger notification
      if (previousDoc && previousDoc.status !== 'exhausted') {
        const NotificationService = require('../services/notification.service').NotificationService;
        await NotificationService.createBudgetExhaustedNotification(
          doc.owner,
          doc
        );
        
        // Log the notification
        await doc.logNotification('budget_exhausted', doc.owner, {
          spentBudget: doc.spentBudget,
          budget: doc.budget
        });
      }
    } catch (error) {
      console.error('Error handling budget exhaustion notification:', error);
    }
  }
});

export const CampaignModel = mongoose.model("Campaign", campaignSchema);