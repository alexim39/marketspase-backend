import { ERROR_MESSAGES, NOTIFICATION_STATUS } from "./notification.constants.js";

export const setupNotificationMethods = (schema) => {
  // Mark notification as read
  schema.methods.markAsRead = async function() {
    if (this.status !== NOTIFICATION_STATUS.READ) {
      this.status = NOTIFICATION_STATUS.READ;
      this.readAt = new Date();
      await this.save();
    }
    return this;
  };

  // Mark notification as dismissed
  schema.methods.dismiss = async function() {
    if (this.status !== NOTIFICATION_STATUS.DISMISSED) {
      this.status = NOTIFICATION_STATUS.DISMISSED;
      await this.save();
    }
    return this;
  };

  // Mark notification as clicked
  schema.methods.markAsClicked = async function() {
    this.clickedAt = new Date();
    
    // Also mark as read if not already
    if (this.status === NOTIFICATION_STATUS.UNREAD) {
      this.status = NOTIFICATION_STATUS.READ;
      this.readAt = new Date();
    }
    
    await this.save();
    return this;
  };

  // Mark as delivered
  schema.methods.markAsDelivered = async function() {
    this.deliveredAt = new Date();
    await this.save();
    return this;
  };

  // Add channel
  schema.methods.addChannel = async function(channel) {
    if (!this.channels.includes(channel)) {
      this.channels.push(channel);
      await this.save();
    }
    return this;
  };

  // Check if notification is for a specific campaign
  schema.methods.isForCampaign = function(campaignId) {
    return this.data?.campaignId?.toString() === campaignId.toString();
  };

  // Check if notification is for a specific promotion
  schema.methods.isForPromotion = function(promotionId) {
    return this.data?.promotionId?.toString() === promotionId.toString();
  };

  // Get notification summary
  schema.methods.getSummary = function() {
    return {
      id: this._id,
      type: this.type,
      title: this.title,
      message: this.message,
      priority: this.priority,
      status: this.status,
      timeAgo: this.timeAgo,
      isRead: this.isRead,
      actionUrl: this.computedActionUrl,
      data: this.data
    };
  };

  // Extend expiration
  schema.methods.extendExpiration = async function(days = 7) {
    const newExpiry = new Date(this.expiresAt);
    newExpiry.setDate(newExpiry.getDate() + days);
    this.expiresAt = newExpiry;
    await this.save();
    return this;
  };

  // Resend notification (mark as unread again)
  schema.methods.resend = async function() {
    this.status = NOTIFICATION_STATUS.UNREAD;
    this.readAt = null;
    this.sentAt = new Date();
    this.deliveredAt = null;
    this.clickedAt = null;
    await this.save();
    return this;
  };
};