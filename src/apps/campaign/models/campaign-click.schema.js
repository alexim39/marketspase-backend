import mongoose from "mongoose";

const campaignClickSchema = new mongoose.Schema(
  {
    campaign: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
      index: true,
    },
    promotion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Promotion",
      required: true,
      index: true,
    },
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
    upi: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    clickedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    unitCost: {
      type: Number,
      required: true,
      min: 0,
    },
    cost: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "NGN",
    },
    status: {
      type: String,
      enum: ["billable", "duplicate", "invalid", "exhausted"],
      required: true,
      index: true,
    },
    chargeStatus: {
      type: String,
      enum: ["charged", "not_charged"],
      required: true,
      index: true,
    },
    destinationUrl: {
      type: String,
      trim: true,
    },
    referrer: {
      type: String,
      trim: true,
    },
    source: {
      type: String,
      trim: true,
    },
    ipHash: {
      type: String,
      index: true,
    },
    userAgentHash: String,
    deviceType: {
      type: String,
      enum: ["mobile", "desktop", "tablet", "unknown"],
      default: "unknown",
    },
    dedupeKey: {
      type: String,
      index: true,
    },
    billableKey: {
      type: String,
      unique: true,
      sparse: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

campaignClickSchema.index({ campaign: 1, clickedAt: -1 });
campaignClickSchema.index({ promotion: 1, clickedAt: -1 });
campaignClickSchema.index({ promoter: 1, clickedAt: -1 });
campaignClickSchema.index({ marketer: 1, clickedAt: -1 });
campaignClickSchema.index({ campaign: 1, status: 1, clickedAt: -1 });
campaignClickSchema.index({ promotion: 1, status: 1, clickedAt: -1 });

export default campaignClickSchema;
