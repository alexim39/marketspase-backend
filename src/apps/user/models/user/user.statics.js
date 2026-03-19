export const setupUserStatics = (schema) => {
  // Find users by role with notification preferences
  schema.statics.findByRoleWithNotifications = async function(role, notificationType) {
    return this.find({
      role,
      'notificationSettings': { $exists: true }
    }).select('uid email notificationSettings deviceTokens');
  };

  // Find users who should receive a specific notification type
  schema.statics.findUsersForNotification = async function(notificationType, channel = 'inApp') {
    return this.find({
      'isActive': true,
      'isDeleted': false,
      $or: [
        { [`notificationSettings.${notificationType}.${channel}`]: true },
        { [`notificationSettings.${notificationType}.${channel}`]: { $exists: false } }
      ]
    });
  };

  // Clean up all inactive connections across all users
  schema.statics.cleanupAllInactiveConnections = async function() {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    return this.updateMany(
      { 'sseConnections.lastActive': { $lt: twentyFourHoursAgo } },
      { 
        $pull: { 
          sseConnections: { lastActive: { $lt: twentyFourHoursAgo } } 
        } 
      }
    );
  };

  // Find users by recent activity
  schema.statics.findByRecentActivity = async function(action, hours = 24) {
    const cutoffDate = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    return this.find({
      'activityLog': {
        $elemMatch: {
          action: action,
          timestamp: { $gte: cutoffDate }
        }
      }
    });
  };
  
  // Bulk cleanup of old activities across all users
  schema.statics.cleanupAllOldActivities = async function() {
    const users = await this.find({ 'activitySettings.retainPeriod': { $exists: true } });
    
    const cleanupPromises = users.map(user => user.cleanupOldActivities());
    return Promise.all(cleanupPromises);
  };
  
  // Get system-wide activity statistics
  schema.statics.getActivityStats = async function(days = 30) {
    const cutoffDate = new Date(Date.now() - days * 60 * 60 * 24 * 1000);
    
    return this.aggregate([
      { $unwind: '$activityLog' },
      { $match: { 'activityLog.timestamp': { $gte: cutoffDate } } },
      {
        $group: {
          _id: '$activityLog.action',
          count: { $sum: 1 },
          lastPerformed: { $max: '$activityLog.timestamp' }
        }
      },
      { $sort: { count: -1 } }
    ]);
  };
};