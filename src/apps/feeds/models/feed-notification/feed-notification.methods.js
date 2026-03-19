import { ACTIVITY_ACTIONS } from "./feed-notification.constants.js";

export const setupFeedNotificationMethods = (schema) => {
  // Mark notification as read
  schema.methods.markAsRead = async function() {
    if (!this.isRead) {
      this.isRead = true;
      this.readAt = new Date();
      await this.save();
    }
    return this;
  };

  // Mark notification as clicked
  schema.methods.markAsClicked = async function() {
    if (!this.isClicked) {
      this.isClicked = true;
      this.clickedAt = new Date();
      await this.save();
    }
    return this;
  };

  // Mark as read and clicked (for when user navigates to the content)
  schema.methods.markAsReadAndClicked = async function() {
    const now = new Date();
    this.isRead = true;
    this.isClicked = true;
    this.readAt = now;
    this.clickedAt = now;
    return this.save();
  };

  // Check if notification is for a specific post
  schema.methods.isForPost = function(postId) {
    return this.post && this.post.toString() === postId.toString();
  };

  // Check if notification is from a specific actor
  schema.methods.isFromActor = function(actorId) {
    return this.actor.toString() === actorId.toString();
  };

  // Get notification age in hours
  schema.methods.getAgeInHours = function() {
    const now = new Date();
    const diffMs = now - this.createdAt;
    return diffMs / (1000 * 60 * 60);
  };

  // Get notification summary
  schema.methods.getSummary = function() {
    return {
      id: this._id,
      type: this.type,
      message: this.message,
      isRead: this.isRead,
      isClicked: this.isClicked,
      timeAgo: this.getTimeAgo(),
      actor: this.actor,
      post: this.post
    };
  };

  // Get time ago string
  schema.methods.getTimeAgo = function() {
    const seconds = Math.floor((new Date() - this.createdAt) / 1000);
    
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

  // Update metadata
  schema.methods.updateMetadata = function(updates) {
    this.metadata = {
      ...this.metadata,
      ...updates,
      updatedAt: new Date()
    };
    return this.save();
  };
};