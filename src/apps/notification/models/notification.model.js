// notification.model.js
import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: [
      'promotion_pending',     // Promoter pending to campaign
      'promotion_assigned',     // Promoter assigned to campaign
      'promotion_submitted',    // Promoter submitted proof
      'promotion_validated',    // Promotion validated
      'promotion_rejected',     // Promotion rejected
      'payment_processed',      // Payment completed
      'campaign_approved',      // Campaign approved by admin
      'campaign_rejected',      // Campaign rejected
      'campaign_completed',     // Campaign reached completion
      'low_balance',           // Marketer wallet low
      'payout_ready',          // Promoter has funds to withdraw
      'system_announcement',   // Platform announcements
      'reminder',               // Reminder notifications
      'weekly_summary',       // Weekly performance summary
      'submission_reminder', // Reminder to submit promotion
      'deadline_reminder',    // Reminder of upcoming campaign deadline
      'refund_processed',  // Refunding marketer wallet from promoter wallet
      'system_report',    // System generated report
      'birthday_greeting'  // User birthday greeting
    ],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  data: {
    // Flexible data object for different notification types
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: "Campaign" },
    promotionId: { type: mongoose.Schema.Types.ObjectId, ref: "Promotion" },
    amount: Number,
    reason: String,
    actionUrl: String, // Deep link for frontend navigation
    metadata: mongoose.Schema.Types.Mixed
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['unread', 'read', 'dismissed'],
    default: 'unread'
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
  },
  sentAt: {
    type: Date,
    default: Date.now
  },
  readAt: Date
}, {
  timestamps: true
});

// Indexes for performance
notificationSchema.index({ recipient: 1, status: 1 });
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Static method to create notification
notificationSchema.statics.createNotification = async function(notificationData) {
  return this.create(notificationData);
};

// Static method to get user notifications
notificationSchema.statics.getUserNotifications = function(userId, options = {}) {
  const { limit = 20, skip = 0, status } = options;
  const query = { recipient: userId };
  
  if (status) query.status = status;
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('data.campaignId', 'title')
    .populate('data.promotionId', 'upi status');
};

// NEW: Static method to clean up old read notifications manually
notificationSchema.statics.cleanupOldReadNotifications = function(daysOld = 7) {
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  
  return this.deleteMany({
    status: { $in: ['read', 'dismissed'] },
    $or: [
      { readAt: { $lt: cutoffDate } },
      { 
        // Also delete if marked as read/dismissed but no readAt (for backward compatibility)
        status: { $in: ['read', 'dismissed'] },
        readAt: { $exists: false },
        createdAt: { $lt: cutoffDate }
      }
    ]
  });
};

// Optional: Also add a method to count notifications that will be deleted (for logging)
notificationSchema.statics.countOldReadNotifications = function(daysOld = 7) {
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  
  return this.countDocuments({
    status: { $in: ['read', 'dismissed'] },
    $or: [
      { readAt: { $lt: cutoffDate } },
      { 
        status: { $in: ['read', 'dismissed'] },
        readAt: { $exists: false },
        createdAt: { $lt: cutoffDate }
      }
    ]
  });
};

export const NotificationModel = mongoose.model("Notification", notificationSchema);