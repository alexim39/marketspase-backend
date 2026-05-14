import mongoose from "mongoose";

const affiliateClickSchema = new mongoose.Schema({
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
  clickedAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  cost: {
    type: Number,
    default: 0,
    min: 0,
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
}, {
  timestamps: true,
});

affiliateClickSchema.index({ promotionTracking: 1, clickedAt: -1 });
affiliateClickSchema.index({ promoter: 1, clickedAt: -1 });
affiliateClickSchema.index({ product: 1, clickedAt: -1 });
affiliateClickSchema.index({ store: 1, clickedAt: -1 });

export default affiliateClickSchema;
