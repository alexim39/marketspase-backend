import mongoose from "mongoose";
import mediaSubSchema from "../media/media.schema.js";
import {
  THREAD_CATEGORY_ARRAY,
  THREAD_STATUS_ARRAY,
  VALIDATION,
  DEFAULTS,
  ERROR_MESSAGES
} from "./thread.constants.js";

const threadSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, ERROR_MESSAGES.TITLE_REQUIRED],
      maxlength: [VALIDATION.TITLE.MAX_LENGTH, ERROR_MESSAGES.TITLE_TOO_LONG],
      trim: true,
      index: true
    },
    
    slug: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true
    },
    
    content: {
      type: String,
      required: [true, ERROR_MESSAGES.CONTENT_REQUIRED],
      maxlength: [VALIDATION.CONTENT.MAX_LENGTH, ERROR_MESSAGES.CONTENT_TOO_LONG],
      trim: true
    },
    
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, ERROR_MESSAGES.AUTHOR_REQUIRED],
      index: true
    },
    
    tags: {
      type: [String],
      default: DEFAULTS.TAGS,
      validate: {
        validator: function (tags) {
          return tags.length <= VALIDATION.TAGS.MAX_COUNT;
        },
        message: ERROR_MESSAGES.TOO_MANY_TAGS
      },
      index: true
    },
    
    media: {
      type: mediaSubSchema,
      required: false,
      default: null
    },
    
    category: {
      type: String,
      enum: THREAD_CATEGORY_ARRAY,
      default: DEFAULTS.CATEGORY,
      index: true
    },
    
    status: {
      type: String,
      enum: THREAD_STATUS_ARRAY,
      default: DEFAULTS.STATUS,
      index: true
    },
    
    likeCount: { 
      type: Number, 
      default: DEFAULTS.LIKE_COUNT,
      min: 0
    },
    
    likedBy: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    
    commentCount: { 
      type: Number, 
      default: DEFAULTS.COMMENT_COUNT,
      min: 0
    },
    
    viewCount: { 
      type: Number, 
      default: DEFAULTS.VIEW_COUNT,
      min: 0
    },
    
    isPinned: { 
      type: Boolean, 
      default: DEFAULTS.IS_PINNED,
      index: true
    },
    
    isLocked: { 
      type: Boolean, 
      default: DEFAULTS.IS_LOCKED,
      index: true
    },
    
    isDeleted: {
      type: Boolean,
      default: DEFAULTS.IS_DELETED,
      index: true
    },
    
    deletedAt: {
      type: Date,
      default: null
    },
    
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    
    lastActivityAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    
    lastCommentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    
    lastCommentAt: {
      type: Date,
      default: null
    },
    
    pinnedAt: {
      type: Date,
      default: null
    },
    
    pinnedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    
    lockedAt: {
      type: Date,
      default: null
    },
    
    lockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    
    trendingScore: {
      type: Number,
      default: 0,
      index: -1
    },
    
    metadata: {
      ipAddress: String,
      userAgent: String,
      source: { type: String, default: 'web' }
    },
    
    mentions: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      username: String
    }],
    
    hashtags: [{
      tag: String,
      count: { type: Number, default: 1 }
    }],

    pinnedAt: {
      type: Date,
      default: null
    },
    
    pinnedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    
    trendingScore: {
      type: Number,
      default: 0,
      index: -1
    },

     isPinned: { 
    type: Boolean, 
    default: false,
    index: true
  },
  
  pinnedAt: {
    type: Date,
    default: null
  },
  
  pinnedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  pinOrder: {
    type: Number,
    default: null,
    index: true
  },
  
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

export default threadSchema;