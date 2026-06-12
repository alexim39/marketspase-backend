import mongoose from "mongoose";

const fraudReasonSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    score: { type: Number, min: 0, default: 0 },
    details: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const actionLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true, trim: true },
    details: { type: String, trim: true, default: "" },
    performedByAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const promotionFraudCaseSchema = new mongoose.Schema(
  {
    promoter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    marketer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    promotion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Promotion",
      required: true,
      index: true,
    },
    campaign: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: [
        "open",
        "warning_sent",
        "final_warning_sent",
        "suspended",
        "resolved",
        "dismissed",
      ],
      default: "open",
      index: true,
    },
    riskLevel: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
      index: true,
    },
    riskScore: {
      type: Number,
      min: 0,
      default: 0,
    },
    detectionTypes: {
      type: [String],
      default: [],
      index: true,
    },
    reasons: {
      type: [fraudReasonSchema],
      default: [],
    },
    evidence: {
      clickIds: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: "CampaignClick",
        default: [],
      },
      ipHashes: { type: [String], default: [] },
      userAgentHashes: { type: [String], default: [] },
      referrers: { type: [String], default: [] },
      sources: { type: [String], default: [] },
      firstDetectedAt: Date,
      lastDetectedAt: Date,
      lastClickAt: Date,
      totalObservedClicks: { type: Number, min: 0, default: 0 },
      billableObservedClicks: { type: Number, min: 0, default: 0 },
      duplicateObservedClicks: { type: Number, min: 0, default: 0 },
      invalidObservedClicks: { type: Number, min: 0, default: 0 },
      matchedPromoterFingerprint: { type: Boolean, default: false },
      notes: { type: String, trim: true, default: "" },
    },
    actionLog: {
      type: [actionLogSchema],
      default: [],
    },
    warningSentAt: Date,
    finalWarningSentAt: Date,
    suspendedAt: Date,
    suspendedUntil: Date,
    permanentLinkSuspendedAt: Date,
    permanentLinkSuspendedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    reviewedAt: Date,
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    resolutionNotes: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

promotionFraudCaseSchema.index(
  { promotion: 1, promoter: 1, status: 1 },
  {
    partialFilterExpression: {
      status: { $in: ["open", "warning_sent", "final_warning_sent", "suspended"] },
    },
    name: "ix_open_fraud_case_per_promotion",
  }
);

promotionFraudCaseSchema.index({ status: 1, updatedAt: -1 });
promotionFraudCaseSchema.index({ promoter: 1, updatedAt: -1 });
promotionFraudCaseSchema.index({ campaign: 1, updatedAt: -1 });

export const PromotionFraudCaseModel = mongoose.model(
  "PromotionFraudCase",
  promotionFraudCaseSchema
);
