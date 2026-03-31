import mongoose from "mongoose";
import {
  MESSAGE_TYPE_ARRAY,
  MESSAGE_PRIORITY_ARRAY,
  TARGET_AUDIENCE_ARRAY,
  DEFAULTS,
  VALIDATION,
  ERROR_MESSAGES
} from "./banner-message.constants.js";

const bannerMessageSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, ERROR_MESSAGES.TITLE_REQUIRED],
    trim: true,
    minlength: VALIDATION.TITLE.MIN_LENGTH,
    maxlength: VALIDATION.TITLE.MAX_LENGTH
  },
  message: {
    type: String,
    required: [true, ERROR_MESSAGES.MESSAGE_REQUIRED],
    trim: true,
    minlength: VALIDATION.MESSAGE.MIN_LENGTH,
    maxlength: VALIDATION.MESSAGE.MAX_LENGTH
  },
  type: {
    type: String,
    enum: MESSAGE_TYPE_ARRAY,
    default: DEFAULTS.TYPE
  },
  priority: {
    type: String,
    enum: MESSAGE_PRIORITY_ARRAY,
    default: DEFAULTS.PRIORITY
  },
  targetAudience: {
    type: String,
    enum: TARGET_AUDIENCE_ARRAY,
    default: DEFAULTS.TARGET_AUDIENCE
  },
  specificUserGroups: [{
    type: String,
    trim: true
  }],
  startDate: {
    type: Date,
    required: [true, ERROR_MESSAGES.START_DATE_REQUIRED],
    index: true
  },
  endDate: {
    type: Date,
    required: [true, ERROR_MESSAGES.END_DATE_REQUIRED],
    index: true
  },
  isActive: {
    type: Boolean,
    default: DEFAULTS.IS_ACTIVE
  },
  showBanner: {
    type: Boolean,
    default: DEFAULTS.SHOW_BANNER
  },
  bannerColor: {
    type: String,
    default: DEFAULTS.BANNER_COLOR,
    match: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/
  },
  textColor: {
    type: String,
    default: DEFAULTS.TEXT_COLOR,
    match: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/
  },
  icon: {
    type: String,
    default: DEFAULTS.ICON
  },
  actionLink: {
    type: String,
    default: DEFAULTS.ACTION_LINK,
    trim: true
  },
  actionText: {
    type: String,
    default: DEFAULTS.ACTION_TEXT,
    trim: true
  },
  dismissible: {
    type: Boolean,
    default: DEFAULTS.DISMISSIBLE
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, ERROR_MESSAGES.CREATED_BY_REQUIRED]
  },
  // Additional fields for better tracking
  viewCount: {
    type: Number,
    default: 0,
    min: 0
  },
  dismissCount: {
    type: Number,
    default: 0,
    min: 0
  },
  clickCount: {
    type: Number,
    default: 0,
    min: 0
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // Soft delete
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date,
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

export default bannerMessageSchema;