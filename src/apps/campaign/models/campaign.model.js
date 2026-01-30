import mongoose from "mongoose";

// A utility constant for enums
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
        budget: { type: Number, required: true, min: 1000 }, // Min 1000 NGN
        currency: { type: String, default: "NGN" },

        // Promotion & Tracking
        maxPromoters: { type: Number, required: true, min: 1 },
        currentPromoters: { type: Number, required: true, min: 0, default: 0 },
        totalPromotions: { type: Number, default: 0 },
        validatedPromotions: { type: Number, default: 0 },
        paidPromotions: { type: Number, default: 0 },
        
        /**
         * 🔥 FUND FLOW LOGIC:
        * spentBudget is ONLY mutated via transactional services.
        * Models must NEVER recalculate it automatically.
         */
        spentBudget: { type: Number, default: 0 },

        totalPayouts: { type: Number, default: 0 },

        reservedBudget: { type: Number, default: 0 },

        payoutModel: {
            type: String,
            enum: ['fixed_per_promoter'],
            default: 'fixed_per_promoter'
        },

        payoutTierId: { type: String, required: true },
        payoutPerPromotion: { type: Number, required: true },
        minViewsPerPromotion: { type: Number, required: true },
        maxViewsPerPromotion: { type: Number },
        rejectedPromotions: { type: Number, default: 0 },

        // Targeting & Requirements
        enableTarget: { type: Boolean, default: false },
        ageTarget: {
            type: String,
            enum: ['all', 'young', 'middle', 'advanced'],
            default: 'all'
        },
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
// targeting indexes   
campaignSchema.index({ ageTarget: 1, status: 1 });
campaignSchema.index({ category: 1, ageTarget: 1, status: 1 });
campaignSchema.index({ priority: -1, createdAt: -1 });

// New (recommended):
campaignSchema.index({ enableTarget: 1, status: 1 });                        // gate + status
campaignSchema.index({ minRating: 1, status: 1 });                            // rating filter
campaignSchema.index({ 'targetLocations.name': 1, status: 1 });               // location name filter
campaignSchema.index({ isDeleted: 1, status: 1 });                            // soft-delete gate
// If you frequently query with category + enableTarget + status:
campaignSchema.index({ category: 1, enableTarget: 1, status: 1 });


/* ------------------------------------------------------------
   🔥 PRE-SAVE HOOK (NON-FINANCIAL)
   - NEVER recalculates spentBudget
   - Handles expiry + duration display ONLY
   - All fund flow is handled in transactional services
------------------------------------------------------------- */

campaignSchema.pre('save', function(next) {

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
    return this.spentBudget || 0;
});

// Virtual for remaining budget
campaignSchema.virtual('remainingBudget').get(function() {
    return this.budget - (this.spentBudget + (this.reservedBudget || 0));
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
  // 🚫 Campaign must be active
  if (this.status !== "active") return false;

  // 🚫 Slot limit reached
  if (this.currentPromoters >= this.maxPromoters) return false;

  // 🚫 Budget logically exhausted
  const available = this.budget - (this.spentBudget + this.reservedBudget);
  if (available < this.payoutPerPromotion) {
    this.status = "exhausted";
    this._justExhausted = true;
    return false;
  }

  // ✅ Slot allocation ONLY (no money yet)
  this.currentPromoters += 1;
  this.totalPromotions += 1;

  this.activityLog.push({
    action: "Promoter Accepted",
    details: `Promoter accepted. Slots used: ${this.currentPromoters}/${this.maxPromoters}`,
    timestamp: new Date()
  });

  return true;
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

        // Only set ObjectId fields if a valid id was provided
        if (performedBy && mongoose.Types.ObjectId.isValid(performedBy)) {
            this.createdBy = performedBy; // Track who performed the status change
        }

        const activityEntry = {
            action: "Status Changed",
            details: `Status changed from ${oldStatus} to ${newStatus}. ${details}`,
            timestamp: new Date()
        };

        if (performedBy && mongoose.Types.ObjectId.isValid(performedBy)) {
            activityEntry.performedBy = performedBy;
        }

        this.activityLog.push(activityEntry);
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

    
    // Mark campaigns as expired when endDate has passed
    async markExpiredCampaigns() {
        const now = new Date();

        // Find campaigns with:
        // - hasEndDate = true
        // - endDate already passed
        // - status is still NOT expired, archived, or completed (you can adjust)

        const campaigns = await this.find({
            hasEndDate: true,
            endDate: { $lt: now },
            status: 'active'
            // status: { $nin: ['expired', 'archived', 'completed'] }
        });

        if (!campaigns.length) {
            return { matched: 0, modified: 0 };
        }

        console.log(`Found ${campaigns.length} campaigns already expired`)

        const ids = campaigns.map((c) => c._id);

        const result = await this.updateMany(
            { _id: { $in: ids } },
            {
            $set: { status: 'expired' },
            $push: {
                activityLog: {
                action: 'Status Changed',
                details: 'Auto-expired by scheduler: endDate passed.',
                timestamp: new Date()
                }
            }
            }
        );

        return {
            matched: result.matchedCount ?? result.n,
            modified: result.modifiedCount ?? result.nModified
        };
    },

    // Mark campaigns as exhausted when all budget has been paid out and campaign has no end date
    async markExhaustedCampaigns() {
        // Find campaigns with:
        // - hasEndDate = false
        // - endDate is not set
        // - Remaining budget is less than or equal to 0
        // - Status is still active
        // - spentBudget equals budget

        const campaigns = await this.find({
            hasEndDate: false,
            endDate: { $exists: false },
            status: 'active',
            $expr: {
                $and: [
                    { $lte: [{ $subtract: ['$budget', { $add: ['$spentBudget', '$reservedBudget'] }] }, 0] },
                    { $eq: ['$spentBudget', '$budget'] }
                ]
            }
        });

        if (!campaigns.length) {
            return { matched: 0, modified: 0 };
        }

        console.log(`Found ${campaigns.length} campaigns with exhausted budgets`);

        const ids = campaigns.map((c) => c._id);

        const result = await this.updateMany(
            { _id: { $in: ids } },
            {
                $set: { status: 'exhausted' },
                $push: {
                    activityLog: {
                        action: 'Status Changed',
                        details: 'Auto-exhausted by scheduler: budget fully paid out.',
                        timestamp: new Date()
                    }
                }
            }
        );

        return {
            matched: result.matchedCount ?? result.n,
            modified: result.modifiedCount ?? result.nModified
        };
    }

};



campaignSchema.set('toObject', { virtuals: true });
campaignSchema.set('toJSON', { virtuals: true });

/* ------------------------------------------------------------
   POST-SAVE HOOK
   Handles post-save actions like budget exhaustion notifications.
------------------------------------------------------------- */

campaignSchema.post('save', async function(doc) {
    if (doc._justExhausted) {
        await doc.logNotification('budget_exhausted', doc.owner, {
            spentBudget: doc.spentBudget,
            budget: doc.budget
        });
        await doc.save();
    }
});


export const CampaignModel = mongoose.model("Campaign", campaignSchema);