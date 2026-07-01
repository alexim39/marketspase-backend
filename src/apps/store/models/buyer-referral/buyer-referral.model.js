import mongoose from "mongoose";
import crypto from "crypto";

const buyerReferralSchema = new mongoose.Schema({
  referrerUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  referredUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
    default: null,
  },
  code: {
    type: String,
    unique: true,
    required: true,
    index: true,
  },
  discountPercent: {
    type: Number,
    default: 5,
    min: 0,
    max: 100,
  },
  rewardAmount: {
    type: Number,
    default: 500,
    min: 0,
  },
  status: {
    type: String,
    enum: ["active", "used", "expired"],
    default: "active",
    index: true,
  },
  usedAt: {
    type: Date,
    default: null,
  },
  expiresAt: {
    type: Date,
    default: function () {
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    },
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

buyerReferralSchema.pre("validate", function (next) {
  if (!this.code) {
    this.code = crypto.randomBytes(6).toString("hex").substring(0, 8);
  }
  next();
});

buyerReferralSchema.pre("save", function (next) {
  if (this.expiresAt && this.expiresAt < new Date() && this.status === "active") {
    this.status = "expired";
  }
  next();
});

export const BuyerReferralModel = mongoose.model(
  "BuyerReferral",
  buyerReferralSchema
);
