import mongoose from "mongoose";

const campaignSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: { type: String, required: true },
    description: { type: String, required: true },

    // WhatsApp status content
    mediaUrl: { type: String }, // image / video to be posted
    caption: { type: String },  // text caption
    link: { type: String },     // optional CTA link

    // Budgeting
    budget: { type: Number, required: true }, // total campaign budget
    payoutPerPromotion: { type: Number, required: true },
    maxPromoters: { type: Number, required: true },
    currency: { type: String, default: "NGN" },

    // Tracking
    totalPromotions: { type: Number, default: 0 },       
    validatedPromotions: { type: Number, default: 0 },   
    paidPromotions: { type: Number, default: 0 },        
    spentBudget: { type: Number, default: 0 },           

    // Campaign timeline
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date },

    // Status
    status: {
      type: String,
      enum: ["active", "paused", "completed", "exhausted", "expired"],
      default: "active",
    },
  },
  { timestamps: true }
);

// Helper methods
campaignSchema.methods.canAssignPromoter = function () {
  return (
    this.status === "active" &&
    this.totalPromotions < this.maxPromoters &&
    this.spentBudget + this.payoutPerPromotion <= this.budget
  );
};

campaignSchema.methods.updateStats = function (promotion) {
  if (promotion.status === "validated") {
    this.validatedPromotions += 1;
  }
  if (promotion.status === "paid") {
    this.paidPromotions += 1;
    this.spentBudget += promotion.payoutAmount;
  }

  if (
    this.validatedPromotions >= this.maxPromoters ||
    this.spentBudget >= this.budget
  ) {
    this.status = "exhausted";
  }
};

export const CampaignModel = mongoose.model("Campaign", campaignSchema);
