import mongoose from "mongoose";
import {
  NOTIFICATION_TYPE_ARRAY,
  NOTIFICATION_PRIORITY_ARRAY,
  NOTIFICATION_STATUS_ARRAY,
  DEFAULTS,
  ERROR_MESSAGES
} from "./notification.constants.js";

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: [true, ERROR_MESSAGES.RECIPIENT_REQUIRED],
    index: true
  },
  
  type: {
    type: String,
    enum: NOTIFICATION_TYPE_ARRAY,
    required: [true, ERROR_MESSAGES.TYPE_REQUIRED]
  },
  
  title: {
    type: String,
    required: [true, ERROR_MESSAGES.TITLE_REQUIRED],
    trim: true
  },
  
  message: {
    type: String,
    required: [true, ERROR_MESSAGES.MESSAGE_REQUIRED],
    trim: true
  },
  
  data: {
    // Flexible data object for different notification types
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: "Campaign" },
    promotionId: { type: mongoose.Schema.Types.ObjectId, ref: "Promotion" },
    amount: { type: Number, min: 0 },
    reason: String,
    actionUrl: String, // Deep link for frontend navigation
    metadata: mongoose.Schema.Types.Mixed
  },
  
  priority: {
    type: String,
    enum: NOTIFICATION_PRIORITY_ARRAY,
    default: DEFAULTS.PRIORITY
  },
  
  status: {
    type: String,
    enum: NOTIFICATION_STATUS_ARRAY,
    default: DEFAULTS.STATUS,
    index: true
  },
  
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + DEFAULTS.EXPIRY_DAYS * 24 * 60 * 60 * 1000),
    index: true
  },
  
  sentAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  readAt: {
    type: Date,
    default: null
  },
  
  // Additional tracking fields
  deliveredAt: {
    type: Date,
    default: null
  },
  
  clickedAt: {
    type: Date,
    default: null
  },
  
  // Channel through which notification was sent
  channels: [{
    type: String,
    enum: ['in_app', 'email', 'push', 'sms']
  }]
  
}, {
  timestamps: true
});

export default notificationSchema;