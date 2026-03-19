import mongoose from "mongoose";
import {
  CONTACT_REASONS_ARRAY,
  CONTACT_STATUS_ARRAY,
  CONTACT_PRIORITY_ARRAY,
  CONTACT_CATEGORY_ARRAY,
  REQUEST_ID_PREFIX,
  DEFAULTS,
  VALIDATION,
  ERROR_MESSAGES
} from "./contact.constants.js";

const contactSchema = mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    reason: {
      type: String,
      required: [true, ERROR_MESSAGES.REASON_REQUIRED],
      enum: CONTACT_REASONS_ARRAY
    },
    subject: {
      type: String,
      required: [true, ERROR_MESSAGES.SUBJECT_REQUIRED],
      trim: true,
      maxlength: VALIDATION.SUBJECT.MAX_LENGTH
    },
    message: {
      type: String,
      required: [true, ERROR_MESSAGES.MESSAGE_REQUIRED],
      trim: true
    },
    status: {
      type: String,
      enum: CONTACT_STATUS_ARRAY,
      default: DEFAULTS.STATUS,
      index: true
    },
    priority: {
      type: String,
      enum: CONTACT_PRIORITY_ARRAY,
      default: DEFAULTS.PRIORITY,
      index: true
    },
    category: {
      type: String,
      enum: CONTACT_CATEGORY_ARRAY,
      default: DEFAULTS.CATEGORY
    },
    requestID: {
      type: String,
      unique: true,
      default: function() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9).toUpperCase();
        return `${REQUEST_ID_PREFIX}-${timestamp}-${random}`;
      }
    },
    attachments: [{
      filename: { type: String, required: true },
      url: { type: String, required: true },
      fileType: String,
      size: Number,
      uploadedAt: { type: Date, default: Date.now }
    }],
    adminNotes: [{
      admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      note: { type: String, required: true },
      createdAt: { type: Date, default: Date.now }
    }],
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: DEFAULTS.ASSIGNED_TO,
      index: true
    },
    resolvedAt: {
      type: Date,
      default: DEFAULTS.RESOLVED_AT
    },
    resolutionNotes: {
      type: String,
      default: DEFAULTS.RESOLUTION_NOTES
    },
    userEmail: {
      type: String,
      required: [true, ERROR_MESSAGES.EMAIL_REQUIRED],
      match: [VALIDATION.EMAIL.PATTERN, ERROR_MESSAGES.EMAIL_INVALID]
    },
    userPhone: {
      type: String,
      default: DEFAULTS.USER_PHONE
    },
    metadata: {
      ipAddress: String,
      userAgent: String,
      browser: String,
      os: String,
      deviceType: String
    },
    followUpDate: {
      type: Date,
      default: DEFAULTS.FOLLOW_UP_DATE
    },
    tags: [{
      type: String,
      trim: true
    }],
    isRead: {
      type: Boolean,
      default: DEFAULTS.IS_READ
    },
    isArchived: {
      type: Boolean,
      default: DEFAULTS.IS_ARCHIVED
    },
    // Audit fields
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

export default contactSchema;