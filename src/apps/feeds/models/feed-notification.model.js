import mongoose from 'mongoose';

const feedNotificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  type: {
    type: String,
    enum: [
      'like',
      'comment',
      'reply',
      'mention',
      'share',
      'save',
      'featured',
      'trending',
      'milestone'
    ],
    required: true
  },
  
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FeedPost'
  },
  
  comment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FeedComment'
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
    default: false,
    index: true
  },
  
  isClicked: {
    type: Boolean,
    default: false
  },
  
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  createdAt: { type: Date, default: Date.now, index: true }
});

// TTL index - auto-delete after 30 days
feedNotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

// Index for user notifications
feedNotificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

export const FeedNotificationModel = mongoose.model('FeedNotification', feedNotificationSchema);