import mongoose from "mongoose";

const productEntrySchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Store",
    required: true,
  },
  trackingCode: {
    type: String,
    trim: true,
  },
  addedAt: {
    type: Date,
    default: Date.now,
  },
  order: {
    type: Number,
    default: 0,
  },
}, { _id: true });

const promoterCollectionSchema = new mongoose.Schema({
  promoter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500,
  },
  coverImage: {
    type: String,
    trim: true,
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    required: true,
    index: true,
  },
  products: [productEntrySchema],
  isPublic: {
    type: Boolean,
    default: true,
  },
  viewCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  shareCount: {
    type: Number,
    default: 0,
    min: 0,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

promoterCollectionSchema.pre("validate", function (next) {
  if (!this.slug && this.name) {
    const base = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const random = Math.random().toString(36).substring(2, 6);
    this.slug = `${base}-${random}`;
  }
  next();
});

export const PromoterCollectionModel = mongoose.model(
  "PromoterCollection",
  promoterCollectionSchema
);
