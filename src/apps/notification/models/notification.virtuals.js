export const setupNotificationVirtuals = (schema) => {
  // Virtual for time ago
  schema.virtual('timeAgo').get(function() {
    const seconds = Math.floor((new Date() - this.sentAt) / 1000);
    
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
  });

  // Virtual for is expired
  schema.virtual('isExpired').get(function() {
    return this.expiresAt && new Date() > this.expiresAt;
  });

  // Virtual for is read
  schema.virtual('isRead').get(function() {
    return this.status === 'read';
  });

  // Virtual for is unread
  schema.virtual('isUnread').get(function() {
    return this.status === 'unread';
  });

  // Virtual for is dismissed
  schema.virtual('isDismissed').get(function() {
    return this.status === 'dismissed';
  });

  // Virtual for age in days
  schema.virtual('ageInDays').get(function() {
    const diffMs = new Date() - this.sentAt;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  });

  // Virtual for formatted sent date
  schema.virtual('formattedSentDate').get(function() {
    return this.sentAt.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  });

  // Virtual for action url (if not set in data)
  schema.virtual('computedActionUrl').get(function() {
    if (this.data?.actionUrl) return this.data.actionUrl;
    
    const { ACTION_URLS } = require('./notification.constants.js');
    const template = ACTION_URLS[this.type];
    
    if (template) {
      if (this.data?.campaignId) {
        return template(this.data.campaignId);
      }
      if (this.data?.promotionId) {
        return template(this.data.promotionId);
      }
      return template();
    }
    
    return null;
  });
};