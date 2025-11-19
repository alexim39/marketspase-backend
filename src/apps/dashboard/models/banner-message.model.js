// models/banner-message.model.js
import mongoose from 'mongoose';

const BannerMessageSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['INFO', 'WARNING', 'ERROR', 'SUCCESS', 'MAINTENANCE'],
    default: 'INFO'
  },
  priority: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    default: 'MEDIUM'
  },
  targetAudience: {
    type: String,
    enum: ['ALL', 'NEW_USERS', 'EXISTING_USERS', 'SPECIFIC_GROUP'],
    default: 'ALL'
  },
  specificUserGroups: [{
    type: String
  }],
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  showBanner: {
    type: Boolean,
    default: true
  },
  bannerColor: {
    type: String,
    default: '#1976d2'
  },
  textColor: {
    type: String,
    default: '#ffffff'
  },
  icon: {
    type: String
  },
  actionLink: {
    type: String
  },
  actionText: {
    type: String
  },
  dismissible: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for efficient querying
BannerMessageSchema.index({ 
  isActive: 1, 
  startDate: 1, 
  endDate: 1,
  targetAudience: 1 
});

export const BannerMessageModel = mongoose.model('BannerMessage', BannerMessageSchema);

const UserDismissalSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  dismissedNotifications: [{
    // BannerMessage IDs
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BannerMessage',
    required: true,
    index: true
  }]
}, {
  timestamps: true
});

export const UserDismissalModel = mongoose.model('UserDismissal', UserDismissalSchema);