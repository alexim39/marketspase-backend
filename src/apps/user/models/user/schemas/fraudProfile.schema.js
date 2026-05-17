import mongoose from "mongoose";

const suspensionHistoryEntrySchema = new mongoose.Schema(
  {
    startedAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    reason: { type: String, trim: true, default: "" },
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PromotionFraudCase",
      default: null,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  { _id: false }
);

const fraudProfileSchema = new mongoose.Schema(
  {
    trustScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 100,
    },
    riskLevel: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "low",
    },
    warningCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    strikeCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    activeCaseCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    lastFlaggedAt: Date,
    lastWarningAt: Date,
    lastFinalWarningAt: Date,
    suspendedUntil: Date,
    suspensionReason: {
      type: String,
      trim: true,
      default: "",
    },
    latestCase: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PromotionFraudCase",
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    suspensionHistory: {
      type: [suspensionHistoryEntrySchema],
      default: [],
    },
  },
  { _id: false }
);

export default fraudProfileSchema;
