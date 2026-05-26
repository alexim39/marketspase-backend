import mongoose from "mongoose";

const STORE_SUBSCRIBER_STATUS = ["subscribed", "unsubscribed"];
const DEVICE_TYPES = ["mobile", "desktop", "tablet", "unknown"];

const storeSubscriberSchema = new mongoose.Schema(
  {
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
      index: true,
    },
    storeOwner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    status: {
      type: String,
      enum: STORE_SUBSCRIBER_STATUS,
      default: "subscribed",
      index: true,
    },
    firstSubscribedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    subscribedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    unsubscribedAt: {
      type: Date,
      default: null,
    },
    source: {
      type: String,
      trim: true,
      default: "storefront",
      index: true,
    },
    referrer: {
      type: String,
      trim: true,
      default: "",
    },
    ipHash: {
      type: String,
      trim: true,
      default: "",
    },
    deviceType: {
      type: String,
      enum: DEVICE_TYPES,
      default: "unknown",
      index: true,
    },
    userAgent: {
      type: String,
      trim: true,
      default: "",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Admin-only moderation: allow removals without losing audit history.
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    deleteReason: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// Prevent double billing / duplicates: one email per store.
storeSubscriberSchema.index({ store: 1, email: 1 }, { unique: true });
storeSubscriberSchema.index({ storeOwner: 1, subscribedAt: -1 });
storeSubscriberSchema.index({ store: 1, subscribedAt: -1 });

export default storeSubscriberSchema;
