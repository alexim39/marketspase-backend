import mongoose from "mongoose";
import {
  NOTIFICATION_TYPE_ARRAY,
  DEFAULTS,
  TTL_CONFIG
} from "./feed-notification.constants.js";

const feedNotificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  type: {
    type: String,
    enum: NOTIFICATION_TYPE_ARRAY,
    required: true
  },
  
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FeedPost'
  },
  
  comment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FeedPost.comments'
  },
  
  actor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  message: {
    type: String,
    required: true
  },
  
  isRead: {
    type: Boolean,
    default: DEFAULTS.IS_READ,
    index: true
  },
  
  isClicked: {
    type: Boolean,
    default: DEFAULTS.IS_CLICKED
  },
  
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: DEFAULTS.METADATA
  },
  
  // Read at timestamp for analytics
  readAt: {
    type: Date,
    default: null
  },
  
  // Clicked at timestamp
  clickedAt: {
    type: Date,
    default: null
  },
  
  // Priority for sorting (optional)
  priority: {
    type: Number,
    default: 0,
    min: 0,
    max: 10
  },
  
  // Group ID for grouping related notifications
  groupId: {
    type: String,
    index: true
  },
  
  createdAt: { type: Date, default: Date.now, index: true }
});

export default feedNotificationSchema;