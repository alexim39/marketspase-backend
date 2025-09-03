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

export const CampaignModel = mongoose.model("Campaign", campaignSchema);