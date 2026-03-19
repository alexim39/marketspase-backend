import { MESSAGE_TEMPLATES } from "./feed-notification.constants.js";

/**
 * Generate notification message based on type and actor
 * @param {string} type - Notification type
 * @param {Object} actor - Actor object with name/username
 * @param {Object} metadata - Additional metadata
 * @returns {string} - Generated message
 */
export const generateMessage = (type, actor, metadata = {}) => {
  const template = MESSAGE_TEMPLATES[type];
  if (!template) {
    return `${actor?.displayName || actor?.username || 'Someone'} performed an action`;
  }

  const actorName = actor?.displayName || actor?.username || 'Someone';
  
  if (type === 'milestone') {
    return template(metadata?.milestone);
  }
  
  return template(actorName);
};

/**
 * Create notification data object
 * @param {Object} data - Notification data
 * @returns {Object} - Formatted notification data
 */
export const createNotificationData = (data) => {
  const {
    recipient,
    type,
    actor,
    post = null,
    comment = null,
    message = null,
    metadata = {}
  } = data;

  return {
    recipient,
    type,
    actor,
    post,
    comment,
    message: message || generateMessage(type, actor, metadata),
    metadata,
    isRead: false,
    isClicked: false,
    createdAt: new Date()
  };
};

/**
 * Group notifications by type
 * @param {Array} notifications - Array of notifications
 * @returns {Object} - Grouped notifications
 */
export const groupByType = (notifications) => {
  return notifications.reduce((acc, notification) => {
    const type = notification.type;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(notification);
    return acc;
  }, {});
};

/**
 * Format notification for response
 * @param {Object} notification - Notification document
 * @param {boolean} includeActor - Whether to include actor details
 * @returns {Object} - Formatted notification
 */
export const formatNotificationResponse = (notification, includeActor = true) => {
  const notif = notification.toObject ? notification.toObject() : notification;
  
  const formatted = {
    id: notif._id,
    type: notif.type,
    message: notif.message,
    isRead: notif.isRead,
    isClicked: notif.isClicked,
    createdAt: notif.createdAt,
    timeAgo: getTimeAgo(notif.createdAt)
  };

  if (notif.post) {
    formatted.post = {
      id: notif.post._id || notif.post,
      ...(notif.post.content && { preview: notif.post.content.substring(0, 100) })
    };
  }

  if (notif.comment) {
    formatted.comment = {
      id: notif.comment._id || notif.comment
    };
  }

  if (includeActor && notif.actor) {
    formatted.actor = {
      id: notif.actor._id || notif.actor,
      username: notif.actor.username,
      displayName: notif.actor.displayName,
      avatar: notif.actor.avatar
    };
  }

  if (notif.metadata && Object.keys(notif.metadata).length > 0) {
    formatted.metadata = notif.metadata;
  }

  return formatted;
};

/**
 * Get time ago string
 * @param {Date} date - Date to compare
 * @returns {string} - Time ago string
 */
export const getTimeAgo = (date) => {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  
  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60
  };
  
  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit);
    if (interval >= 1) {
      return `${interval} ${unit}${interval === 1 ? '' : 's'} ago`;
    }
  }
  
  return 'just now';
};

/**
 * Create a batch of notifications
 * @param {Array} notificationsData - Array of notification data
 * @returns {Array} - Array of notification documents
 */
export const createBatchNotifications = (notificationsData) => {
  return notificationsData.map(data => createNotificationData(data));
};

/**
 * Filter notifications by date range
 * @param {Array} notifications - Array of notifications
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Array} - Filtered notifications
 */
export const filterByDateRange = (notifications, startDate, endDate) => {
  return notifications.filter(notif => {
    const notifDate = new Date(notif.createdAt);
    return (!startDate || notifDate >= startDate) && (!endDate || notifDate <= endDate);
  });
};