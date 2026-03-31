import mongoose from "mongoose";
import {
  REVIEW_STATUS_ARRAY,
  DEVICE_TYPE_ARRAY,
  PLATFORM_TYPE_ARRAY,
  DEFAULTS,
  VALIDATION,
  ERROR_MESSAGES
} from "./review.constants.js";

const reviewSchema = new mongoose.Schema({
  // References
  productId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Product", 
    required: [true, ERROR_MESSAGES.PRODUCT_REQUIRED],
    index: true 
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: [true, ERROR_MESSAGES.USER_REQUIRED],
    index: true 
  },
  storeId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Store", 
    required: [true, ERROR_MESSAGES.STORE_REQUIRED],
    index: true 
  },
  
  // Review Content
  rating: { 
    type: Number, 
    required: [true, ERROR_MESSAGES.RATING_REQUIRED],
    min: VALIDATION.RATING.MIN,
    max: VALIDATION.RATING.MAX 
  },
  title: { 
    type: String, 
    maxlength: VALIDATION.TITLE.MAX_LENGTH,
    trim: true 
  },
  comment: { 
    type: String, 
    required: [true, ERROR_MESSAGES.COMMENT_REQUIRED],
    maxlength: VALIDATION.COMMENT.MAX_LENGTH,
    trim: true 
  },
  images: [{
    url: { type: String, required: true },
    caption: { 
      type: String, 
      maxlength: VALIDATION.IMAGE_CAPTION.MAX_LENGTH,
      trim: true 
    }
  }],
  
  // Verification
  verifiedPurchase: { 
    type: Boolean, 
    default: DEFAULTS.VERIFIED_PURCHASE 
  },
  orderId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Order" 
  },
  variantId: {
    type: mongoose.Schema.Types.ObjectId
  },
  variantName: String,
  
  // Engagement
  helpfulCount: { 
    type: Number, 
    default: DEFAULTS.HELPFUL_COUNT,
    min: 0
  },
  helpfulBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }],
  reportCount: { 
    type: Number, 
    default: DEFAULTS.REPORT_COUNT,
    min: 0
  },
  reportedBy: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reason: { type: String, required: true },
    reportedAt: { type: Date, default: Date.now }
  }],
  
  // Response
  response: {
    content: { 
      type: String,
      maxlength: VALIDATION.RESPONSE_CONTENT.MAX_LENGTH,
      trim: true 
    },
    createdAt: { type: Date, default: Date.now },
    respondedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    responderName: String
  },
  
  // Status & Moderation
  status: { 
    type: String, 
    enum: REVIEW_STATUS_ARRAY,
    default: DEFAULTS.STATUS,
    index: true 
  },
  moderationNotes: String,
  moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  moderatedAt: Date,
  
  // Metadata
  isFeatured: { 
    type: Boolean, 
    default: DEFAULTS.IS_FEATURED,
    index: true 
  },
  metadata: {
    device: { type: String, enum: DEVICE_TYPE_ARRAY },
    platform: { type: String, enum: PLATFORM_TYPE_ARRAY },
    ipAddress: String,
    userAgent: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

export default reviewSchema;