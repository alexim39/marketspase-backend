import mongoose from "mongoose";
import { VALIDATION, DEFAULTS, ERROR_MESSAGES } from "./comment.constants.js";

const commentSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: [true, ERROR_MESSAGES.CONTENT_REQUIRED],
      trim: true,
      maxlength: [VALIDATION.CONTENT.MAX_LENGTH, ERROR_MESSAGES.CONTENT_TOO_LONG]
    },
    
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, ERROR_MESSAGES.AUTHOR_REQUIRED],
      index: true
    },
    
    thread: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Thread',
      required: [true, ERROR_MESSAGES.THREAD_REQUIRED],
      index: true
    },
    
    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Forumcomment',
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
    
    isEdited: {
      type: Boolean,
      default: DEFAULTS.IS_EDITED
    },
    
    lastEditedAt: {
      type: Date,
      default: null
    },
    
    editHistory: [{
      content: String,
      editedAt: { type: Date, default: Date.now },
      editedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }],
    
    status: {
      type: String,
      enum: ['active', 'hidden', 'flagged', 'deleted'],
      default: 'active'
    },
    
    flaggedBy: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      reason: String,
      flaggedAt: { type: Date, default: Date.now }
    }],
    
    mentions: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      username: String
    }],
    
    hashtags: [{
      tag: String,
      count: { type: Number, default: 1 }
    }],
    
    metadata: {
      ipAddress: String,
      userAgent: String,
      source: { type: String, default: 'web' }
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

export default commentSchema;