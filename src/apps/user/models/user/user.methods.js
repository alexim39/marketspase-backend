import {
  ACTIVITY_ACTIONS,
  ACTIVITY_ACTIONS_ARRAY,
  RESOURCE_TYPES_ARRAY,
} from '../activity/activity.constants.js';

export const setupUserMethods = (schema) => {
  const ensureArray = (value) => Array.isArray(value) ? value : [];
  const ensureObject = (value) => (value && typeof value === 'object' ? value : {});
  const knownActions = new Set(ACTIVITY_ACTIONS_ARRAY);
  const knownResourceTypes = new Set(RESOURCE_TYPES_ARRAY);

  // Check if user allows a specific notification type
  schema.methods.canReceiveNotification = function(notificationType, channel = 'inApp') {
    const notificationStats = ensureObject(this.notificationStats);
    const notificationSettings = ensureObject(this.notificationSettings);

    if (notificationStats.muteUntil && notificationStats.muteUntil > new Date()) {
      return false;
    }

    const setting = notificationSettings[notificationType];
    if (!setting) return true;

    return setting[channel] !== false;
  };

  // Add device token for push notifications
  schema.methods.addDeviceToken = function(token, platform) {
    this.deviceTokens = ensureArray(this.deviceTokens);
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
    this.deviceTokens = ensureArray(this.deviceTokens);
    this.deviceTokens = this.deviceTokens.filter(t => t.token !== token);
    return this.save();
  };

  // Add SSE connection
  schema.methods.addSSEConnection = function(connectionId, userAgent, ipAddress) {
    this.sseConnections = ensureArray(this.sseConnections);
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
    this.sseConnections = ensureArray(this.sseConnections);
    this.sseConnections = this.sseConnections.filter(conn => conn.connectionId !== connectionId);
    return this.save();
  };

  // Clean up inactive SSE connections (older than 24 hours)
  schema.methods.cleanupInactiveConnections = function() {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    this.sseConnections = ensureArray(this.sseConnections);
    this.sseConnections = this.sseConnections.filter(
      conn => conn.lastActive > twentyFourHoursAgo
    );
    return this.save();
  };

  // Update notification stats when a notification is read
  schema.methods.markNotificationRead = function() {
    this.notificationStats = { totalRead: 0, ...ensureObject(this.notificationStats) };
    this.notificationStats.totalRead += 1;
    this.notificationStats.lastReadAt = new Date();
    return this.save();
  };

  // Mute all notifications until a specific date
  schema.methods.muteNotifications = function(untilDate) {
    this.notificationStats = ensureObject(this.notificationStats);
    this.notificationStats.muteUntil = untilDate;
    return this.save();
  };

  // Unmute notifications
  schema.methods.unmuteNotifications = function() {
    this.notificationStats = ensureObject(this.notificationStats);
    this.notificationStats.muteUntil = null;
    return this.save();
  };

  // Log user activity
  schema.methods.logActivity = function(action, description, options = {}) {
    const hasPathSelectionInfo = typeof this.isSelected === 'function';
    const activitySettingsSelected = hasPathSelectionInfo ? this.isSelected('activitySettings') : true;
    const activityLogSelected = hasPathSelectionInfo ? this.isSelected('activityLog') : true;

    if (activitySettingsSelected) {
      this.activitySettings = {
        enabled: true,
        retainPeriod: 365,
        ...ensureObject(this.activitySettings)
      };
    }

    if (activitySettingsSelected && this.activitySettings.enabled === false) {
      return Promise.resolve(this);
    }
    
    const normalizedAction = knownActions.has(action)
      ? action
      : ACTIVITY_ACTIONS.SYSTEM_EVENT;
    const normalizedResourceType = options.resourceType && knownResourceTypes.has(options.resourceType)
      ? options.resourceType
      : undefined;

    const activity = {
      action: normalizedAction,
      description,
      resourceType: normalizedResourceType,
      resourceId: options.resourceId,
      metadata: {
        ...(options.metadata || {}),
        ...(normalizedAction !== action ? { originalAction: action } : {}),
        ...(normalizedResourceType !== options.resourceType && options.resourceType
          ? { originalResourceType: options.resourceType }
          : {}),
      },
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      timestamp: new Date()
    };
    
    const maxActivities = 1000;

    if (!activityLogSelected) {
      return this.constructor.updateOne(
        { _id: this._id },
        {
          $push: {
            activityLog: {
              $each: [activity],
              $position: 0,
              $slice: maxActivities
            }
          }
        }
      ).then(() => this);
    }

    this.activityLog = ensureArray(this.activityLog);
    this.activityLog.unshift(activity);
    
    // Limit the number of stored activities
    if (this.activityLog.length > maxActivities) {
      this.activityLog = this.activityLog.slice(0, maxActivities);
    }
    
    return this.save();
  };

  // Get recent activities with pagination
  schema.methods.getRecentActivities = function(limit = 50, offset = 0) {
    this.activityLog = ensureArray(this.activityLog);
    return this.activityLog.slice(offset, offset + limit);
  };
  
  // Search activities by action or description
  schema.methods.searchActivities = function(query, limit = 50) {
    this.activityLog = ensureArray(this.activityLog);
    const searchRegex = new RegExp(query, 'i');
    return this.activityLog.filter(activity => 
      searchRegex.test(activity.action) || 
      searchRegex.test(activity.description)
    ).slice(0, limit);
  };
  
  // Clean up old activities based on retain period
  schema.methods.cleanupOldActivities = function() {
    this.activitySettings = {
      enabled: true,
      retainPeriod: 365,
      ...ensureObject(this.activitySettings)
    };
    this.activityLog = ensureArray(this.activityLog);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.activitySettings.retainPeriod);
    
    this.activityLog = this.activityLog.filter(
      activity => activity.timestamp > cutoffDate
    );
    
    return this.save();
  };
};
