import { createNotificationData, formatNotificationResponse } from "./feed-notification.utils.js";
import { ERROR_MESSAGES, BATCH_LIMITS, NOTIFICATION_TYPE } from "./feed-notification.constants.js";

export const setupFeedNotificationStatics = (schema) => {
  // Create a new notification
  schema.statics.createNotification = async function(data) {
    const notificationData = createNotificationData(data);
    const notification = new this(notificationData);
    return notification.save();
  };

  // Create multiple notifications in batch
  schema.statics.createBatch = async function(notificationsData) {
    if (notificationsData.length > BATCH_LIMITS.MAX_MARK_READ) {
      throw new Error(ERROR_MESSAGES.BATCH_SIZE_EXCEEDED(BATCH_LIMITS.MAX_MARK_READ));
    }

    const notifications = notificationsData.map(data => createNotificationData(data));
    return this.insertMany(notifications);
  };

  // Get notifications for a user
  schema.statics.getForUser = async function(userId, options = {}) {
    const {
      limit = 50,
      skip = 0,
      unreadOnly = false,
      types = null,
      includeActor = true,
      includePost = true
    } = options;

    const query = { recipient: userId };
    
    if (unreadOnly) {
      query.isRead = false;
    }

    if (types && types.length > 0) {
      query.type = { $in: types };
    }

    let dbQuery = this.find(query)
      .sort({ createdAt: -1, priority: -1 })
      .limit(limit)
      .skip(skip);

    if (includeActor) {
      dbQuery = dbQuery.populate('actor', 'username displayName avatar');
    }

    if (includePost) {
      dbQuery = dbQuery.populate('post', 'content media type');
    }

    const notifications = await dbQuery.lean();
    const total = await this.countDocuments(query);
    const unreadCount = await this.countDocuments({ 
      recipient: userId, 
      isRead: false 
    });

    return {
      notifications: notifications.map(n => formatNotificationResponse(n, includeActor)),
      pagination: {
        total,
        unread: unreadCount,
        limit,
        skip,
        hasMore: skip + notifications.length < total
      }
    };
  };

  // Mark multiple notifications as read
  schema.statics.markAsRead = async function(userId, notificationIds = null) {
    const query = { recipient: userId, isRead: false };
    
    if (notificationIds && notificationIds.length > 0) {
      if (notificationIds.length > BATCH_LIMITS.MAX_MARK_READ) {
        throw new Error(ERROR_MESSAGES.BATCH_SIZE_EXCEEDED(BATCH_LIMITS.MAX_MARK_READ));
      }
      query._id = { $in: notificationIds };
    }

    const result = await this.updateMany(
      query,
      {
        $set: {
          isRead: true,
          readAt: new Date()
        }
      }
    );

    return {
      modifiedCount: result.modifiedCount,
      message: `${result.modifiedCount} notifications marked as read`
    };
  };

  // Mark notification as clicked
  schema.statics.markAsClicked = async function(notificationId, userId) {
    const notification = await this.findOne({
      _id: notificationId,
      recipient: userId
    });

    if (!notification) {
      throw new Error(ERROR_MESSAGES.NOTIFICATION_NOT_FOUND);
    }

    notification.isClicked = true;
    notification.clickedAt = new Date();
    
    // Also mark as read if not already
    if (!notification.isRead) {
      notification.isRead = true;
      notification.readAt = new Date();
    }

    await notification.save();
    return notification;
  };

  // Delete notifications
  schema.statics.deleteNotifications = async function(userId, notificationIds = null) {
    const query = { recipient: userId };
    
    if (notificationIds && notificationIds.length > 0) {
      if (notificationIds.length > BATCH_LIMITS.MAX_DELETE) {
        throw new Error(ERROR_MESSAGES.BATCH_SIZE_EXCEEDED(BATCH_LIMITS.MAX_DELETE));
      }
      query._id = { $in: notificationIds };
    }

    const result = await this.deleteMany(query);
    
    return {
      deletedCount: result.deletedCount,
      message: `${result.deletedCount} notifications deleted`
    };
  };

  // Clear all notifications for a user
  schema.statics.clearAll = async function(userId) {
    const result = await this.deleteMany({ recipient: userId });
    
    return {
      deletedCount: result.deletedCount,
      message: `Cleared ${result.deletedCount} notifications`
    };
  };

  // Get unread count for user
  schema.statics.getUnreadCount = async function(userId) {
    return this.countDocuments({
      recipient: userId,
      isRead: false
    });
  };

  // Get notification statistics
  schema.statics.getStats = async function(userId = null) {
    const match = userId ? { recipient: userId } : {};

    const stats = await this.aggregate([
      { $match: match },
      {
        $facet: {
          byType: [
            { $group: { _id: '$type', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ],
          readStats: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                read: { $sum: { $cond: ['$isRead', 1, 0] } },
                unread: { $sum: { $cond: ['$isRead', 0, 1] } },
                clicked: { $sum: { $cond: ['$isClicked', 1, 0] } }
              }
            }
          ],
          dailyActivity: [
            {
              $group: {
                _id: {
                  date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                  type: '$type'
                },
                count: { $sum: 1 }
              }
            },
            { $sort: { '_id.date': -1 } },
            { $limit: 30 }
          ]
        }
      }
    ]);

    return stats[0];
  };

  // Create like notification
  schema.statics.createLikeNotification = async function(recipientId, actorId, postId) {
    return this.createNotification({
      recipient: recipientId,
      type: NOTIFICATION_TYPE.LIKE,
      actor: actorId,
      post: postId
    });
  };

  // Create comment notification
  schema.statics.createCommentNotification = async function(recipientId, actorId, postId, commentId) {
    return this.createNotification({
      recipient: recipientId,
      type: NOTIFICATION_TYPE.COMMENT,
      actor: actorId,
      post: postId,
      comment: commentId
    });
  };

  // Create mention notification
  schema.statics.createMentionNotification = async function(recipientId, actorId, postId) {
    return this.createNotification({
      recipient: recipientId,
      type: NOTIFICATION_TYPE.MENTION,
      actor: actorId,
      post: postId,
      metadata: { mentioned: true }
    });
  };

  // Get notifications by group
  schema.statics.getByGroup = async function(groupId, userId = null) {
    const query = { groupId };
    if (userId) {
      query.recipient = userId;
    }

    return this.find(query)
      .populate('actor', 'username displayName avatar')
      .populate('post', 'content media type')
      .sort({ createdAt: -1 });
  };

  // Clean up old read notifications
  schema.statics.cleanupOldRead = async function(daysOld = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.deleteMany({
      isRead: true,
      readAt: { $lt: cutoffDate }
    });

    return {
      deletedCount: result.deletedCount,
      message: `Cleaned up ${result.deletedCount} old read notifications`
    };
  };
};