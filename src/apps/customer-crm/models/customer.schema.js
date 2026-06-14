import mongoose from "mongoose";

const CUSTOMER_SOURCES = ["manual", "csv_import", "click_capture", "subscriber_sync", "storefront_checkout"];
const CUSTOMER_LIFECYCLE_STAGES = ["new", "active", "repeat", "vip", "at_risk", "suppressed"];

const customerSchema = new mongoose.Schema(
  {
    marketer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      default: null,
      index: true,
    },
    // Source attribution
    promotionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Promotion",
      default: null,
    },
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      default: null,
    },
    source: {
      type: String,
      enum: CUSTOMER_SOURCES,
      default: "manual",
      index: true,
    },
    // Contact identifiers
    displayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    phoneCountryCode: {
      type: String,
      trim: true,
      default: "+234",
    },
    // Segmentation
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    groups: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CustomerGroup",
      },
    ],
    lifecycleStage: {
      type: String,
      enum: CUSTOMER_LIFECYCLE_STAGES,
      default: "new",
      index: true,
    },
    // Compliance
    consent: {
      sms: { type: Boolean, default: false },
      email: { type: Boolean, default: false },
      smsOptInAt: { type: Date, default: null },
      emailOptInAt: { type: Date, default: null },
      smsOptOutAt: { type: Date, default: null },
      emailOptOutAt: { type: Date, default: null },
      consentSource: { type: String, default: "manual_entry" },
    },
    // Analytics
    totalConversions: { type: Number, default: 0, min: 0 },
    totalRevenueGenerated: { type: Number, default: 0, min: 0 },
    lastContactedAt: { type: Date, default: null },
    lastPurchasedAt: { type: Date, default: null },
    orderCount: { type: Number, default: 0, min: 0 },
    totalSpent: { type: Number, default: 0, min: 0 },
    // Metadata
    notes: { type: String, trim: true, maxlength: 5000, default: "" },
    customFields: { type: Map, of: String, default: {} },
    isActive: { type: Boolean, default: true, index: true },
  },
  {
    timestamps: true,
  }
);

// A marketer can have only one contact record per email+phone combination.
customerSchema.index({ marketer: 1, email: 1 }, { sparse: true });
customerSchema.index({ marketer: 1, phone: 1 }, { sparse: true });
customerSchema.index({ marketer: 1, tags: 1 });
customerSchema.index({ marketer: 1, lifecycleStage: 1 });
customerSchema.index({ marketer: 1, createdAt: -1 });
customerSchema.index({ marketer: 1, store: 1 });

export default customerSchema;
