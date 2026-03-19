export const setupUserMethods = (schema) => {
  // Check if user allows a specific notification type
  schema.methods.canReceiveNotification = function(notificationType, channel = 'inApp') {
    if (this.notificationStats.muteUntil && this.notificationStats.muteUntil > new Date()) {
      return false;
    }

    const setting = this.notificationSettings[notificationType];
    if (!setting) return true;

    return setting[channel] !== false;
  };

  // Add device token for push notifications
  schema.methods.addDeviceToken = function(token, platform) {
    const existingToken = this.deviceTokens.find(t => t.token === token);
    if (existingToken) {
      existingToken.lastActive = new Date();
    } else {
      this.deviceTokens.push({ token, platform, lastActive: new Date() });
    }
    return this.save();
  };

  // Remove device token
  schema.methods.removeDeviceToken = function(token) {
    this.deviceTokens = this.deviceTokens.filter(t => t.token !== token);
    return this.save();
  };

  // Add SSE connection
  schema.methods.addSSEConnection = function(connectionId, userAgent, ipAddress) {
    this.sseConnections.push({
      connectionId,
      userAgent,
      ipAddress,
      lastActive: new Date()
    });
    return this.save();
  };

  // Remove SSE connection
  schema.methods.removeSSEConnection = function(connectionId) {
    this.sseConnections = this.sseConnections.filter(conn => conn.connectionId !== connectionId);
    return this.save();
  };

  // Clean up inactive SSE connections (older than 24 hours)
  schema.methods.cleanupInactiveConnections = function() {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    this.sseConnections = this.sseConnections.filter(
      conn => conn.lastActive > twentyFourHoursAgo
    );
    return this.save();
  };

  // Update notification stats when a notification is read
  schema.methods.markNotificationRead = function() {
    this.notificationStats.totalRead += 1;
    this.notificationStats.lastReadAt = new Date();
    return this.save();
  };

  // Mute all notifications until a specific date
  schema.methods.muteNotifications = function(untilDate) {
    this.notificationStats.muteUntil = untilDate;
    return this.save();
  };

  // Unmute notifications
  schema.methods.unmuteNotifications = function() {
    this.notificationStats.muteUntil = null;
    return this.save();
  };

  // Log user activity
  schema.methods.logActivity = function(action, description, options = {}) {
    if (!this.activitySettings.enabled) {
      return Promise.resolve(this);
    }
    
    const activity = {
      action,
      description,
      resourceType: options.resourceType,
      resourceId: options.resourceId,
      metadata: options.metadata || {},
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      timestamp: new Date()
    };
    
    this.activityLog.unshift(activity);
    
    // Limit the number of stored activities
    const maxActivities = 1000;
    if (this.activityLog.length > maxActivities) {
      this.activityLog = this.activityLog.slice(0, maxActivities);
    }
    
    return this.save();
  };

  // Get recent activities with pagination
  schema.methods.getRecentActivities = function(limit = 50, offset = 0) {
    return this.activityLog.slice(offset, offset + limit);
  };
  
  // Search activities by action or description
  schema.methods.searchActivities = function(query, limit = 50) {
    const searchRegex = new RegExp(query, 'i');
    return this.activityLog.filter(activity => 
      searchRegex.test(activity.action) || 
      searchRegex.test(activity.description)
    ).slice(0, limit);
  };
  
  // Clean up old activities based on retain period
  schema.methods.cleanupOldActivities = function() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.activitySettings.retainPeriod);
    
    this.activityLog = this.activityLog.filter(
      activity => activity.timestamp > cutoffDate
    );
    
    return this.save();
  };
};