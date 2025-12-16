import mongoose from "mongoose";

// A utility constant for enums
//const CAMPAIGN_STATUSES = ["pending", "active", "paused", "rejected", "completed", "exhausted", "expired", "draft", "archived"];
const CAMPAIGN_STATUSES = ["active", "paused", "rejected", "completed", "exhausted", "expired", "pending", "draft", "archived"];

// Define the schema
const campaignSchema = new mongoose.Schema(
    {
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        title: { type: String, required: true },

        // Media Content
        mediaUrl: { type: String, required: true },
        caption: { type: String },
        link: { type: String }, // optional CTA link
        category: { type: String, required: true },
        mediaType: { type: String, enum: ['image', 'video'], required: true },
        thumbnailUrl: { type: String },

        // Budgeting
        budget: { type: Number, required: true, min: 500 }, // Min 500 NGN
        payoutPerPromotion: { type: Number, required: true, min: 200 },
        currency: { type: String, default: "NGN" },

        // Promotion & Tracking
        maxPromoters: { type: Number, required: true, min: 1 },
        currentPromoters: { type: Number, required: true, min: 0, default: 0 },
        minViewsPerPromotion: { type: Number, required: true, min: 40, default: 40 }, // Min 40 added back
        totalPromotions: { type: Number, default: 0 },
        validatedPromotions: { type: Number, default: 0 },
        paidPromotions: { type: Number, default: 0 },
        
        /**
         * 🔥 FUND FLOW LOGIC: This value is AUTOMATICALLY calculated via pre('save')
         * and should NOT be manually set in controllers (except perhaps initial creation).
         */
        spentBudget: { type: Number, default: 0 },

        // Targeting & Requirements
        enableTarget: { type: Boolean, default: false },
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
            enum: CAMPAIGN_STATUSES,
            default: "pending",
        },

        // Notification tracking fields
        notificationLog: [{
            type: {
                type: String,
                enum: [
                    'campaign_approved', 'campaign_rejected', 'budget_exhausted', 'submission_reminder',
                    'promotion_assigned', 'promotion_submitted', 'promotion_validated', 'promotion_rejected',
                    'low_balance', 'payment_processed', 'deadline_reminder', 'promotion_apending',
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
            sentAt: [Date],
            lastAlertPercentage: { type: Number, default: 0 }
        },

        // Submission reminder tracking
        submissionReminders: {
            lastSent: Date,
            sentCount: { type: Number, default: 0 }
        },

        // Campaign deletion
        isDeleted: { type: Boolean, default: false },
        deletedAt: Date,
        deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

        // Additional fields
        difficulty: {
            type: String,
            enum: ["easy", "medium", "hard"],
            default: "medium"
        },
        tags: [{ type: String }],
        estimatedViews: { type: Number, default: 0 },
        duration: { type: String },

        // A log for campaign actions (RE-ADDED)
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
            //required: true
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },

        // Store integration
        store: { type: mongoose.Schema.Types.ObjectId, ref: "Store" },
        promotionType: {
            type: String,
            enum: ["product_promotion", "store_promotion", "category_promotion"],
            default: "product_promotion"
        },
        promotedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],

        // Store promotion settings
        promotionGoal: {
            type: String,
            enum: ["awareness", "traffic", "conversions", "sales"],
            default: "traffic"
        }
    },
    { timestamps: true }
);

// Indexes for better query performance
campaignSchema.index({ category: 1, status: 1 });
campaignSchema.index({ startDate: 1, endDate: 1 });
campaignSchema.index({ status: 1, priority: -1 });
campaignSchema.index({ 'notificationLog.sentAt': 1 });
campaignSchema.index({ spentBudget: 1, budget: 1 });

/* ------------------------------------------------------------
   🔥 PRE-SAVE HOOK: FUND FLOW LOGIC
   1. Automatically recalculates spentBudget.
   2. Sets estimated views and duration.
------------------------------------------------------------- */
campaignSchema.pre('save', function(next) {
    // 1. FUND FLOW: spentBudget is derived from paidPromotions
    this.spentBudget = (this.paidPromotions * this.payoutPerPromotion) || 0;
    
    // 2. Estimate Views & Duration (from old model)
    if (this.isModified('maxPromoters') || this.isNew) {
        // Estimate 45 views per promoter on average
        this.estimatedViews = this.maxPromoters * 45;
    }

    // Check if budget is exhausted
    if (this.spentBudget >= this.budget) {
        this.status = 'exhausted';
    }

    // Check if campaign is expired
    if (this.hasEndDate && this.endDate) {
        const now = new Date();
        if (now > new Date(this.endDate)) {
            this.status = 'expired';
        }
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

/* ------------------------------------------------------------
   VIRTUALS
------------------------------------------------------------- */

// Use calculatedSpentBudget for runtime consistency
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

// Virtual for promotions population
campaignSchema.virtual('promotions', {
    ref: 'Promotion',
    localField: '_id',
    foreignField: 'campaign'
});

/* ------------------------------------------------------------
   METHODS
   Ensuring core fund logic is maintained in assignPromoter & recordPromoterPayment.
------------------------------------------------------------- */

// Method to assign a promoter (used during acceptance)
campaignSchema.methods.assignPromoter = function () {
    // 1. FUND FLOW CHECK (Stage 1/2 Gate): Check if the next payout exceeds the budget
    const potentialSpentBudget = (this.currentPromoters * this.payoutPerPromotion);
    //const potentialSpentBudget = (this.paidPromotions * this.payoutPerPromotion || this.currentPromoters * this.payoutPerPromotion);
    const potentialSpend = potentialSpentBudget + this.payoutPerPromotion;

    if (potentialSpend > this.budget) {
        this.status = "exhausted";
        return false;
    }

    // 2. Campaign Limits Check
    if (this.currentPromoters >= this.maxPromoters || this.status !== "active") {
        return false;
    }

    this.totalPromotions += 1;
    this.currentPromoters += 1;

    // Add to activity log
    this.activityLog.push({
        action: "Promoter Assigned",
        details: `New promoter assigned. Total promoters: ${this.totalPromotions}`,
        timestamp: new Date()
    });

    return true; // Return true on successful assignment
};

// Method to record payment to a promoter (used during validation/payment - Stage 4)
campaignSchema.methods.recordPromoterPayment = function () {
    // FUND FLOW LOGIC: ONLY increment paidPromotions.
    // spentBudget is handled automatically by the pre('save') hook.
    this.paidPromotions += 1;
    
    // Check if budget is exhausted (for immediate status update)
    const newSpentBudget = (this.paidPromotions * this.payoutPerPromotion);
    if (newSpentBudget >= this.budget) {
        this.status = "exhausted";
    }

    // Add to activity log
    this.activityLog.push({
        action: "Promoter Paid",
        details: `Promoter paid ${this.payoutPerPromotion} ${this.currency}. Total paid: ${this.paidPromotions}`,
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
    console.log(`Campaign ${this._id}: Status changing from ${this.status} to ${newStatus} by user ${performedBy}`);
    const oldStatus = this.status;
    if (CAMPAIGN_STATUSES.includes(newStatus)) {
        this.status = newStatus;
        this.createdBy = performedBy; // Track who performed the status change
        
        this.activityLog.push({
            action: "Status Changed",
            details: `Status changed from ${oldStatus} to ${newStatus}. ${details}`,
            timestamp: new Date(),
            performedBy: performedBy
        });
    }
    
    return this;
};


// Notification-related methods (RE-ADDED)
campaignSchema.methods.logNotification = function(notificationType, sentTo, metadata = {}) {
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
    
    return this;
};

campaignSchema.methods.wasNotificationRecentlySent = function(notificationType, userId, hours = 24) {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    return this.notificationLog.some(notification => 
        notification.type === notificationType &&
        notification.sentTo.toString() === userId.toString() &&
        notification.sentAt > cutoffTime
    );
};

campaignSchema.methods.shouldSendBudgetAlert = function(thresholdPercentage = 80) {
    const utilization = this.budgetUtilization;
    
    // Don't send if already exhausted
    if (this.status === 'exhausted') return false;
    
    // Check if we've crossed the threshold and haven't alerted for this threshold
    if (utilization >= thresholdPercentage && 
        this.budgetAlerts.lastAlertPercentage < thresholdPercentage) {
        return true;
    }
    
    return false;
};

campaignSchema.methods.recordBudgetAlert = function(percentage) {
    this.budgetAlerts.sentAt.push(new Date());
    this.budgetAlerts.lastAlertPercentage = percentage;
    return this; // Return this, as saving is done in the service/caller
};

// Simplified submission reminder check (The original logic was complex and required the initial assignment time, which is hard to track precisely from `createdAt`)
campaignSchema.methods.shouldSendSubmissionReminder = function() {
    // Implement reminder logic based on campaign age and last reminder sent
    if (this.status !== 'active' || this.totalPromotions === 0) return false;
    
    const now = new Date();
    const reminderFrequencyHours = 48; // Send every 48 hours for active campaigns with promoters
    const lastSentTime = this.submissionReminders.lastSent;

    if (!lastSentTime) return true; // Send first one

    return (now - lastSentTime) / (1000 * 60 * 60) > reminderFrequencyHours;
};

campaignSchema.methods.recordSubmissionReminder = function() {
    this.submissionReminders.lastSent = new Date();
    this.submissionReminders.sentCount += 1;
    return this; // Return this, as saving is done in the service/caller
};

campaignSchema.methods.getPerformanceSummary = function() {
    return {
        totalPromotions: this.totalPromotions,
        validatedPromotions: this.validatedPromotions,
        paidPromotions: this.paidPromotions,
        spentBudget: this.spentBudget,
        remainingBudget: this.remainingBudget,
        progress: this.progress,
        estimatedViews: this.estimatedViews
    };
};

/* ------------------------------------------------------------
   STATICS (for scheduled tasks/cron jobs)
------------------------------------------------------------- */
campaignSchema.statics = {
    // Find campaigns that need budget alerts
    async findCampaignsNeedingBudgetAlerts(thresholdPercentage = 80) {
        // Use $expr to calculate utilization within the query
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
        const lastReminderCutoff = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48 hours ago
        
        return this.find({
            status: 'active',
            $or: [
                { 'submissionReminders.lastSent': { $lt: lastReminderCutoff } },
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
};



campaignSchema.set('toObject', { virtuals: true });
campaignSchema.set('toJSON', { virtuals: true });

/* ------------------------------------------------------------
   POST-SAVE HOOK
   Handles post-save actions like budget exhaustion notifications.
------------------------------------------------------------- */
campaignSchema.post('save', async function(doc) {
    // Check if budget just got exhausted
    if (doc.status === 'exhausted' && doc.isModified('status')) {
        try {
            // NOTE: In a modular environment, you would import NotificationService here.
            // For this self-contained model, we assume access to the service or a dedicated notification handler.
            const Campaign = mongoose.model('Campaign');
            const previousDoc = await Campaign.findById(doc._id);
            
            // Check if status truly changed to exhausted (to avoid double-notifying)
            if (previousDoc && previousDoc.status !== 'exhausted') {
                // Assuming NotificationService.createBudgetExhaustedNotification exists
                // const NotificationService = require('../services/notification.service').NotificationService;
                // await NotificationService.createBudgetExhaustedNotification(doc.owner, doc);
                
                // Log the notification
                await doc.logNotification('budget_exhausted', doc.owner, {
                    spentBudget: doc.spentBudget,
                    budget: doc.budget
                });
                await doc.save();
            }
        } catch (error) {
            console.error('Error handling budget exhaustion notification in post-save:', error);
        }
    }
});

export const CampaignModel = mongoose.model("Campaign", campaignSchema);