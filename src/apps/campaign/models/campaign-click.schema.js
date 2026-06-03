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
    promoterPayoutAmount: {
      type: Number,
      min: 0,
      default: undefined,
    },
    platformRetainedAmount: {
      type: Number,
      min: 0,
      default: undefined,
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
    // Raw IP is stored for admin fraud investigation and geo analytics.
    // Older records may not have this populated.
    ip: {
      type: String,
      trim: true,
      default: "",
    },
    userAgentHash: String,
    deviceType: {
      type: String,
      enum: ["mobile", "desktop", "tablet", "unknown"],
      default: "unknown",
    },
    geo: {
      country: { type: String, trim: true, default: "" },
      region: { type: String, trim: true, default: "" },
      city: { type: String, trim: true, default: "" },
      timezone: { type: String, trim: true, default: "" },
      ll: { type: [Number], default: undefined }, // [lat, lon]
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
    chargeLockKey: {
      type: String,
      unique: true,
      sparse: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    payoutPolicy: {
      policyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "PromoterPpcPayoutPolicy",
        default: null,
      },
      payoutMode: {
        type: String,
        trim: true,
        default: "",
      },
      fixedPayoutPerClick: {
        type: Number,
        min: 0,
        default: undefined,
      },
      reason: {
        type: String,
        trim: true,
        default: "",
      },
      startsAt: Date,
      endsAt: Date,
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
campaignClickSchema.index({ ip: 1, clickedAt: -1 });
campaignClickSchema.index({ "geo.country": 1, clickedAt: -1 });
campaignClickSchema.index({ "payoutPolicy.policyId": 1, clickedAt: -1 });

export default campaignClickSchema;
