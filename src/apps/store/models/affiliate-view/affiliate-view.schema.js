import mongoose from "mongoose";

// Event-level view tracking for storefront affiliate promotions.
// This is intentionally lightweight and append-only so we can build time-series analytics
// (daily/weekly/monthly views, unique viewers, device mix, sources, etc.).
const affiliateViewSchema = new mongoose.Schema(
  {
    promotionTracking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PromotionTracking",
      required: true,
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
      index: true,
    },
    promoter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    viewedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    deviceType: {
      type: String,
      enum: ["mobile", "desktop", "tablet"],
      default: "desktop",
    },
    source: {
      type: String,
      trim: true,
      default: "direct",
    },
    referrer: {
      type: String,
      trim: true,
    },
    ipHash: {
      type: String,
      trim: true,
    },
    userAgent: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["recorded", "invalid"],
      default: "recorded",
      index: true,
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

affiliateViewSchema.index({ promotionTracking: 1, viewedAt: -1 });
affiliateViewSchema.index({ promoter: 1, viewedAt: -1 });
affiliateViewSchema.index({ product: 1, viewedAt: -1 });
affiliateViewSchema.index({ store: 1, viewedAt: -1 });

export default affiliateViewSchema;

