import mongoose from "mongoose";

const promotionSchema = new mongoose.Schema({
  campaign: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Campaign",
    required: true
  },
  promoter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  status: {
    type: String,
    enum: ["pending", "submitted", "validated", "rejected", "paid"],
    default: "pending"
  },
  submittedAt: Date,
  validatedAt: Date,
  paidAt: Date,
  proofMedia: [String], // URLs to proof screenshots
  proofViews: Number, // Number of views reported by promoter
  payoutAmount: Number,
  rejectionReason: String,
  notes: String
}, { timestamps: true });

// Index to prevent duplicate applications
promotionSchema.index({ campaign: 1, promoter: 1 }, { unique: true });

export const PromotionModel = mongoose.model("Promotion", promotionSchema);