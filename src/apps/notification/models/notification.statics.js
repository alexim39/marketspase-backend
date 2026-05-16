import { DEFAULTS, NOTIFICATION_STATUS } from "./notification.constants.js";

export const setupNotificationStatics = (schema) => {
  // Create a new notification
  schema.statics.createNotification = async function(notificationData) {
    const notification = new this(notificationData);
    return notification.save();
  };

  // Create multiple notifications in batch
  schema.statics.createBatch = async function(notificationsData) {
    return this.insertMany(notificationsData);
  };

  // Get user notifications with pagination and filtering
  schema.statics.getUserNotifications = function(userId, options = {}) {
    const { 
      limit = 20, 
      skip = 0, 
      status, 
      priority,
      type,
      includeExpired = false 
    } = options;
    
    const query = { recipient: userId };
    
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (type) query.type = type;
    if (!includeExpired) {
      query.$or = [
        { expiresAt: { $gt: new Date() } },
        { expiresAt: { $exists: false } }
      ];
    }
    
    return this.find(query)
      .select('type title message data status priority createdAt readAt expiresAt')
      .sort({ createdAt: -1, priority: -1 })
      .skip(skip)
      .limit(limit)
      .populate({ path: 'data.campaignId', select: 'title status', options: { lean: true } })
      .populate({ path: 'data.promotionId', select: 'upi status', options: { lean: true } })
      .lean();
  };

  // Get unread count for user
  schema.statics.getUnreadCount = async function(userId) {
    return this.countDocuments({
      recipient: userId,
      status: NOTIFICATION_STATUS.UNREAD,
      $or: [
        { expiresAt: { $gt: new Date() } },
        { expiresAt: { $exists: false } }
      ]
    });
  };

  // Mark all user notifications as read
  schema.statics.markAllAsRead = async function(userId) {
    const result = await this.updateMany(
      { 
        recipient: userId, 
        status: NOTIFICATION_STATUS.UNREAD 
      },
      { 
        $set: { 
          status: NOTIFICATION_STATUS.READ, 
          readAt: new Date() 
        } 
      }
    );
    
    return {
      modifiedCount: result.modifiedCount,
      message: `${result.modifiedCount} notifications marked as read`
    };
  };

  // Dismiss all user notifications
  schema.statics.dismissAll = async function(userId) {
    const result = await this.updateMany(
      { recipient: userId },
      { $set: { status: NOTIFICATION_STATUS.DISMISSED } }
    );
    
    return {
      modifiedCount: result.modifiedCount,
      message: `${result.modifiedCount} notifications dismissed`
    };
  };

  // Clean up old read notifications
  schema.statics.cleanupOldReadNotifications = async function(daysOld = DEFAULTS.CLEANUP_DAYS) {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    
    const result = await this.deleteMany({
      status: { $in: [NOTIFICATION_STATUS.READ, NOTIFICATION_STATUS.DISMISSED] },
      $or: [
        { readAt: { $lt: cutoffDate } },
        { 
          status: { $in: [NOTIFICATION_STATUS.READ, NOTIFICATION_STATUS.DISMISSED] },
          readAt: { $exists: false },
          createdAt: { $lt: cutoffDate }
        }
      ]
    });
    
    return {
      deletedCount: result.deletedCount,
      message: `Cleaned up ${result.deletedCount} old notifications`
    };
  };

  // Count old read notifications (for logging)
  schema.statics.countOldReadNotifications = async function(daysOld = DEFAULTS.CLEANUP_DAYS) {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    
    return this.countDocuments({
      status: { $in: [NOTIFICATION_STATUS.READ, NOTIFICATION_STATUS.DISMISSED] },
      $or: [
        { readAt: { $lt: cutoffDate } },
        { 
          status: { $in: [NOTIFICATION_STATUS.READ, NOTIFICATION_STATUS.DISMISSED] },
          readAt: { $exists: false },
          createdAt: { $lt: cutoffDate }
        }
      ]
    });
  };

  // Get notification statistics for a user
  schema.statics.getUserStats = async function(userId) {
    const stats = await this.aggregate([
      { $match: { recipient: userId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const totals = await this.aggregate([
      { $match: { recipient: userId } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          byType: { $push: { type: '$type', count: 1 } }
        }
      }
    ]);
    
    const unreadCount = await this.getUnreadCount(userId);
    
    return {
      unread: unreadCount,
      byStatus: stats.reduce((acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {}),
      total: totals[0]?.total || 0
    };
  };

  // Delete notifications by user
  schema.statics.deleteByUser = async function(userId, notificationIds = null) {
    const query = { recipient: userId };
    
    if (notificationIds && notificationIds.length > 0) {
      query._id = { $in: notificationIds };
    }
    
    const result = await this.deleteMany(query);
    
    return {
      deletedCount: result.deletedCount,
      message: `${result.deletedCount} notifications deleted`
    };
  };

  // Get notifications that need reminders
  schema.statics.getPendingReminders = async function() {
    const now = new Date();
    
    return this.find({
      type: { $in: ['reminder', 'submission_reminder', 'deadline_reminder'] },
      status: NOTIFICATION_STATUS.UNREAD,
      'data.reminderTime': { $lte: now },
      'data.reminderSent': { $ne: true }
    });
  };
};
