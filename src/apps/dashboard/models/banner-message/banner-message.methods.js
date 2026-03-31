import { COLOR_THEMES } from "./banner-message.constants.js";

export const setupBannerMessageMethods = (schema) => {
  // Check if banner is currently active
  schema.methods.isCurrentlyActive = function() {
    const now = new Date();
    return this.isActive && 
           !this.isDeleted &&
           this.startDate <= now && 
           this.endDate >= now;
  };

  // Get banner status
  schema.methods.getStatus = function() {
    const now = new Date();
    
    if (this.isDeleted) return 'DELETED';
    if (!this.isActive) return 'INACTIVE';
    if (now < this.startDate) return 'SCHEDULED';
    if (now > this.endDate) return 'EXPIRED';
    return 'ACTIVE';
  };

  // Get remaining days
  schema.methods.getRemainingDays = function() {
    if (!this.isCurrentlyActive()) return 0;
    
    const now = new Date();
    const diffTime = this.endDate - now;
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  };

  // Get banner with theme colors
  schema.methods.getWithTheme = function() {
    const theme = COLOR_THEMES[this.type] || COLOR_THEMES.INFO;
    
    return {
      ...this.toObject(),
      bannerColor: this.bannerColor || theme.banner,
      textColor: this.textColor || theme.text,
      icon: this.icon || theme.icon
    };
  };

  // Increment view count
  schema.methods.incrementView = async function() {
    this.viewCount += 1;
    return this.save();
  };

  // Increment dismiss count
  schema.methods.incrementDismiss = async function() {
    this.dismissCount += 1;
    return this.save();
  };

  // Increment click count
  schema.methods.incrementClick = async function() {
    this.clickCount += 1;
    return this.save();
  };

  // Soft delete
  schema.methods.softDelete = async function(deletedBy) {
    this.isDeleted = true;
    this.deletedAt = new Date();
    this.deletedBy = deletedBy;
    this.isActive = false;
    return this.save();
  };

  // Restore soft-deleted banner
  schema.methods.restore = async function() {
    this.isDeleted = false;
    this.deletedAt = null;
    this.deletedBy = null;
    return this.save();
  };

  // Get banner summary
  schema.methods.getSummary = function() {
    return {
      id: this._id,
      title: this.title,
      type: this.type,
      priority: this.priority,
      status: this.getStatus(),
      startDate: this.startDate,
      endDate: this.endDate,
      isActive: this.isActive,
      showBanner: this.showBanner,
      remainingDays: this.getRemainingDays(),
      stats: {
        views: this.viewCount,
        dismissals: this.dismissCount,
        clicks: this.clickCount
      }
    };
  };

  // Extend banner end date
  schema.methods.extendEndDate = function(days, extendedBy) {
    const newEndDate = new Date(this.endDate);
    newEndDate.setDate(newEndDate.getDate() + days);
    this.endDate = newEndDate;
    this.metadata = {
      ...this.metadata,
      lastExtendedAt: new Date(),
      lastExtendedBy: extendedBy,
      extensionDays: days
    };
    return this.save();
  };
};