import mongoose from "mongoose";

const storeCustomerSchema = new mongoose.Schema({
  store: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Store",
    required: true,
    index: true
  },
  marketer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    index: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    index: true
  },
  customerType: {
    type: String,
    enum: ["registered", "guest"],
    default: "guest",
    index: true
  },
  fullName: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    trim: true
  },
  marketingOptIn: {
    type: Boolean,
    default: true
  },
  source: {
    type: String,
    trim: true,
    default: "storefront_checkout"
  },
  firstTrackingCode: {
    type: String,
    trim: true
  },
  firstTrackingRef: {
    type: String,
    trim: true
  },
  lastTrackingCode: {
    type: String,
    trim: true
  },
  lastTrackingRef: {
    type: String,
    trim: true
  },
  firstOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order"
  },
  lastOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order"
  },
  firstSeenAt: {
    type: Date,
    default: Date.now
  },
  lastOrderAt: Date,
  orderCount: {
    type: Number,
    default: 0,
    min: 0
  },
  totalSpent: {
    type: Number,
    default: 0,
    min: 0
  },
  tags: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true
});

storeCustomerSchema.index({ store: 1, email: 1 }, { unique: true });
storeCustomerSchema.index({ store: 1, lastOrderAt: -1 });
storeCustomerSchema.index({ marketer: 1, lastOrderAt: -1 });

export default storeCustomerSchema;
