import mongoose from "mongoose";
import {
  TESTIMONIAL_STATUS_ARRAY,
  REACTION_TYPE_ARRAY,
  DEFAULTS,
  VALIDATION,
  ERROR_MESSAGES
} from "./testimonial.constants.js";

const testimonialSchema = mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, ERROR_MESSAGES.USER_REQUIRED],
      index: true
    },
    
    message: {
      type: String,
      maxlength: [VALIDATION.MESSAGE.MAX_LENGTH, ERROR_MESSAGES.MESSAGE_TOO_LONG],
      trim: true,
      required: [true, ERROR_MESSAGES.MESSAGE_REQUIRED]
    },
    
    status: {
      type: String,
      enum: TESTIMONIAL_STATUS_ARRAY,
      default: DEFAULTS.STATUS,
      index: true
    },
    
    likes: {
      type: Number,
      default: DEFAULTS.LIKES,
      min: 0
    },
    
    dislikes: {
      type: Number,
      default: DEFAULTS.DISLIKES,
      min: 0
    },
    
    reactions: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      reaction: {
        type: String,
        enum: REACTION_TYPE_ARRAY,
        required: true
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],
    
    isFeatured: {
      type: Boolean,
      default: DEFAULTS.IS_FEATURED,
      index: true
    },
    
    rating: {
      type: Number,
      min: VALIDATION.RATING.MIN,
      max: VALIDATION.RATING.MAX,
      default: DEFAULTS.RATING
    },
    
    // Admin review fields
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewedAt: {
      type: Date,
      default: null
    },
    reviewNotes: {
      type: String,
      trim: true
    },
    
    // Soft delete
    isDeleted: {
      type: Boolean,
      default: false
    },
    deletedAt: {
      type: Date,
      default: null
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

export default testimonialSchema;