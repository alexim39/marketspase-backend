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
    mediaUrl: { type: String }, // Media is required for a campaign
    caption: { type: String },
    link: { type: String }, // optional CTA link
    category: { type: String, required: true },
    mediaType: { type: String, required: true, default: "image" },

    // Budgeting
    budget: { type: Number, required: true, min: 1000 }, // Updated min to 1000 NGN
    payoutPerPromotion: { type: Number, required: true, min: 100 },
    currency: { type: String, default: "NGN" },

    // Promotion & Tracking
    maxPromoters: { type: Number, required: true, min: 1 }, 
    currentPromoters: { type: Number, required: true, min: 0, default: 0 },
    minViewsPerPromotion: { type: Number, required: true, min: 25, default: 25 },
    totalPromotions: { type: Number, default: 0 },
    validatedPromotions: { type: Number, default: 0 },
    paidPromotions: { type: Number, default: 0 },
    spentBudget: { type: Number, default: 0 },
    
    // Targeting & Requirements
    enableTarget: { type: Boolean, default: false },
    targetLocations: [{ type: String }],
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
      default: "medium" 
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

    // campaign deletion
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
campaignSchema.index({ owner: 1, status: 1 });
campaignSchema.index({ category: 1, status: 1 });
campaignSchema.index({ startDate: 1, endDate: 1 });
campaignSchema.index({ status: 1, priority: -1 });

// Virtual for remaining budget
campaignSchema.virtual('remainingBudget').get(function() {
  return this.budget - this.spentBudget;
});

// Virtual for progress percentage
campaignSchema.virtual('progress').get(function() {
  if (this.maxPromoters === 0) return 0;
  return (this.currentPromoters / this.maxPromoters) * 100;
});

// Virtual for remaining days
campaignSchema.virtual('remainingDays').get(function() {
  if (!this.endDate || !this.hasEndDate) return 'N/A';
  
  const now = new Date();
  const end = new Date(this.endDate);
  const diffTime = end.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return 'Expired';
  if (this.status === 'exhausted') return 'Budget Exhausted';
  return diffDays;
});

// Helper method to check if a promoter can be assigned
campaignSchema.methods.canAssignPromoter = function () {
  return (
    this.status === "active" &&
    this.totalPromotions < this.maxPromoters &&
    (this.spentBudget + this.payoutPerPromotion) <= this.budget
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

// Post-init middleware to update virtuals when loading from DB
campaignSchema.post('init', function() {
  // This ensures virtuals are properly set when loading from database
  if (this.spentBudget >= this.budget && this.status !== 'exhausted') {
    this.status = 'exhausted';
  }
});

export const CampaignModel = mongoose.model("Campaign", campaignSchema);








/* import mongoose from "mongoose";

const campaignSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: { type: String, required: true },

    // WhatsApp status content
    mediaUrl: { type: String }, // Media is required for a campaign
    caption: { type: String },
    link: { type: String }, // optional CTA link
    category: { type: String },
    mediaType: { type: String },

    // Budgeting
    budget: { type: Number, required: true, min: 500 }, // Ensure budget is at least 500 NGN
    payoutPerPromotion: { type: Number, required: true, min: 200 },
    currency: { type: String, default: "NGN" },

    // Promotion & Tracking
    maxPromoters: { type: Number, required: true, min: 1 }, 
    currentPromoters: { type: Number, required: true, min: 0, default: 0 }, // Track current number of promoters
    minViewsPerPromotion: { type: Number, required: true, min: 25, default: 25 }, // New field from your description
    totalPromotions: { type: Number, default: 0 },
    validatedPromotions: { type: Number, default: 0 },
    paidPromotions: { type: Number, default: 0 },
    spentBudget: { type: Number, default: 0 },
    enableTarget: { type: Boolean, dafault: true },
    // Campaign timeline
    startDate: { type: Date, required: true, default: Date.now },
    endDate: { type: Date },

    // Status
    status: {
      type: String,
      enum: ["active", "paused", "rejected", "completed", "exhausted", "expired", "pending"],
      default: "pending", // Set initial status to 'pending' for admin review
    },
    
    // A log for campaign actions (e.g., start, pause, review)
    // This can be useful for auditing and dispute resolution
    activityLog: [
      {
        action: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        details: { type: String },
      },
    ],
  },
  { timestamps: true }
);

// Helper method to check if a promoter can be assigned
campaignSchema.methods.canAssignPromoter = function () {
  return (
    this.status === "active" &&
    this.totalPromotions < this.maxPromoters &&
    this.spentBudget + this.payoutPerPromotion <= this.budget
  );
};

// Helper method to update stats after a promotion is validated or paid
campaignSchema.methods.updateStats = function (promotion) {
  if (promotion.status === "validated") {
    this.validatedPromotions += 1;
    this.spentBudget += this.payoutPerPromotion; // Assume payout is spent upon validation
  }
  
  // Logic to update paidPromotions can be handled when a transfer is confirmed
  // if (promotion.status === "paid") {
  //   this.paidPromotions += 1;
  // }
  
  if (
    this.validatedPromotions >= this.maxPromoters ||
    this.spentBudget >= this.budget
  ) {
    this.status = "exhausted";
  }
};

// Add these methods to your campaign schema
// Check if campaign can accept more promoters
campaignSchema.methods.canAssignPromoter = function () {
  return (
    this.status === "active" &&
    this.totalPromotions < this.maxPromoters && (this.spentBudget + this.payoutPerPromotion) <= this.budget
  );
};

// Method to assign a promoter
campaignSchema.methods.assignPromoter = function () {
  if (!this.canAssignPromoter()) {
    throw new Error('Cannot assign promoter - campaign is full or budget exhausted');
  }

  this.totalPromotions += 1;
  this.currentPromoters += 1;
  this.spentBudget += this.payoutPerPromotion;

  // Update status if needed
  if (this.totalPromotions >= this.maxPromoters || this.spentBudget >= this.budget) {
    this.status = "exhausted";
  }

  // Add to activity log
  this.activityLog.push({
    action: "Promoter Assigned",
    details: `New promoter assigned. Total promoters: ${this.totalPromotions}`,
    timestamp: new Date()
  });

  return this;
};


campaignSchema.virtual('promotions', {
  ref: 'Promotion',
  localField: '_id',
  foreignField: 'campaign'
});
campaignSchema.set('toObject', { virtuals: true });
campaignSchema.set('toJSON', { virtuals: true });

export const CampaignModel = mongoose.model("Campaign", campaignSchema); */