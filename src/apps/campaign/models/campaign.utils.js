import { THRESHOLDS } from "./campaign.constants.js";

/**
 * Calculate days between two dates
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {number} - Number of days
 */
export const calculateDaysBetween = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Format duration string
 * @param {number} days - Number of days
 * @returns {string} - Formatted duration string
 */
export const formatDuration = (days) => {
  if (!days) return 'Ongoing';
  return `${days} day${days !== 1 ? 's' : ''}`;
};

/**
 * Calculate remaining days until end date
 * @param {Date} endDate - End date
 * @param {string} status - Campaign status
 * @returns {number|string} - Remaining days or status message
 */
export const calculateRemainingDays = (endDate, status) => {
  if (!endDate) return 'No End Date';
  
  const now = new Date();
  const end = new Date(endDate);
  const diffTime = end.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return 'Expired';
  if (status === 'exhausted') return 'Budget Exhausted';
  return diffDays;
};

/**
 * Check if a notification was recently sent
 * @param {Array} notificationLog - Notification log array
 * @param {string} type - Notification type
 * @param {string} userId - User ID
 * @param {number} hours - Hours threshold
 * @returns {boolean} - True if recently sent
 */
export const wasNotificationRecentlySent = (notificationLog, type, userId, hours = THRESHOLDS.RECENT_NOTIFICATION_HOURS) => {
  const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  return notificationLog.some(notification => 
    notification.type === type &&
    notification.sentTo.toString() === userId.toString() &&
    notification.sentAt > cutoffTime
  );
};

/**
 * Check if budget alert should be sent
 * @param {number} utilization - Budget utilization percentage
 * @param {number} lastAlertPercentage - Last alert percentage
 * @param {string} status - Campaign status
 * @param {number} threshold - Threshold percentage
 * @returns {boolean} - True if alert should be sent
 */
export const shouldSendBudgetAlert = (utilization, lastAlertPercentage, status, threshold = THRESHOLDS.BUDGET_ALERT_PERCENTAGE) => {
  if (status === 'exhausted') return false;
  return utilization >= threshold && lastAlertPercentage < threshold;
};

/**
 * Check if submission reminder should be sent
 * @param {string} status - Campaign status
 * @param {number} totalPromotions - Total promotions
 * @param {Date} lastSent - Last reminder sent date
 * @param {number} frequencyHours - Frequency in hours
 * @returns {boolean} - True if reminder should be sent
 */
export const shouldSendSubmissionReminder = (status, totalPromotions, lastSent, frequencyHours = THRESHOLDS.SUBMISSION_REMINDER_FREQUENCY_HOURS) => {
  if (status !== 'active' || totalPromotions === 0) return false;
  
  if (!lastSent) return true;
  
  const now = new Date();
  return (now - lastSent) / (1000 * 60 * 60) > frequencyHours;
};

/**
 * Create activity log entry
 * @param {string} action - Action performed
 * @param {string} details - Additional details
 * @param {ObjectId} performedBy - User who performed the action
 * @returns {Object} - Activity log entry
 */
export const createActivityEntry = (action, details = '', performedBy = null) => {
  const entry = {
    action,
    details,
    timestamp: new Date()
  };
  
  if (performedBy) {
    entry.performedBy = performedBy;
  }
  
  return entry;
};

/**
 * Create notification log entry
 * @param {string} type - Notification type
 * @param {ObjectId} sentTo - User to send to
 * @param {Object} metadata - Additional metadata
 * @returns {Object} - Notification log entry
 */
export const createNotificationEntry = (type, sentTo, metadata = {}) => ({
  type,
  sentTo,
  sentAt: new Date(),
  metadata
});