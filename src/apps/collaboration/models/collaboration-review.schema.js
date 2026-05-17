import mongoose from "mongoose";

const collaborationReviewFlagSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reason: {
      type: String,
      trim: true,
      required: true,
      maxlength: 120,
    },
    details: {
      type: String,
      trim: true,
      default: "",
      maxlength: 800,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const collaborationReviewSchema = new mongoose.Schema(
  {
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reviewee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    campaign: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      default: null,
      index: true,
    },
    promotion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Promotion",
      default: null,
      index: true,
    },
    relationshipType: {
      type: String,
      enum: ["marketer_to_promoter", "promoter_to_marketer"],
      required: true,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    title: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },
    comment: {
      type: String,
      trim: true,
      maxlength: 1500,
      default: "",
    },
    status: {
      type: String,
      enum: ["published", "flagged", "hidden", "removed"],
      default: "published",
      index: true,
    },
    flagCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    flags: {
      type: [collaborationReviewFlagSchema],
      default: [],
    },
    moderatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    moderationNotes: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1500,
    },
    adminResponse: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1500,
    },
    publishedAt: {
      type: Date,
      default: Date.now,
    },
    hiddenAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

collaborationReviewSchema.index(
  { reviewer: 1, reviewee: 1, promotion: 1 },
  { unique: true, partialFilterExpression: { promotion: { $type: "objectId" } } }
);
collaborationReviewSchema.index({ reviewee: 1, status: 1, createdAt: -1 });
collaborationReviewSchema.index({ reviewer: 1, createdAt: -1 });

export default collaborationReviewSchema;
