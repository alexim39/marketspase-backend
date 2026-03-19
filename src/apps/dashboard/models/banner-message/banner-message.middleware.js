import { VALIDATION, ERROR_MESSAGES, COLOR_THEMES } from "./banner-message.constants.js";

export const setupBannerMessageMiddleware = (schema) => {
  // Pre-save middleware
  schema.pre('save', function(next) {
    // Validate date range
    if (this.startDate && this.endDate) {
      if (this.endDate <= this.startDate) {
        return next(new Error(ERROR_MESSAGES.INVALID_DATE_RANGE));
      }

      // Check duration
      const durationDays = Math.ceil((this.endDate - this.startDate) / (1000 * 60 * 60 * 24));
      if (durationDays > VALIDATION.DATE_RANGE.MAX_DAYS) {
        return next(new Error(ERROR_MESSAGES.DATE_RANGE_TOO_LONG));
      }
    }

    // Apply theme colors if not set
    if (!this.bannerColor || !this.textColor || !this.icon) {
      const theme = COLOR_THEMES[this.type] || COLOR_THEMES.INFO;
      this.bannerColor = this.bannerColor || theme.banner;
      this.textColor = this.textColor || theme.text;
      this.icon = this.icon || theme.icon;
    }

    // Clean up specificUserGroups if targetAudience is not SPECIFIC_GROUP
    if (this.targetAudience !== 'SPECIFIC_GROUP') {
      this.specificUserGroups = [];
    }

    // Trim and clean data
    if (this.title) this.title = this.title.trim();
    if (this.message) this.message = this.message.trim();
    if (this.actionLink) this.actionLink = this.actionLink.trim();
    if (this.actionText) this.actionText = this.actionText.trim();

    next();
  });

  // Pre-update middleware
  schema.pre('findOneAndUpdate', function(next) {
    const update = this.getUpdate();

    // Validate date range if both dates are being updated
    if (update.startDate && update.endDate) {
      if (update.endDate <= update.startDate) {
        return next(new Error(ERROR_MESSAGES.INVALID_DATE_RANGE));
      }

      const durationDays = Math.ceil((update.endDate - update.startDate) / (1000 * 60 * 60 * 24));
      if (durationDays > VALIDATION.DATE_RANGE.MAX_DAYS) {
        return next(new Error(ERROR_MESSAGES.DATE_RANGE_TOO_LONG));
      }
    }

    // Apply theme colors if type is being updated
    if (update.type) {
      const theme = COLOR_THEMES[update.type] || COLOR_THEMES.INFO;
      update.bannerColor = update.bannerColor || theme.banner;
      update.textColor = update.textColor || theme.text;
      update.icon = update.icon || theme.icon;
    }

    next();
  });

  // Post-save middleware
  schema.post('save', function(doc) {
    // Could emit event for real-time updates
    // emit('banner.created', doc);
  });

  // Post-find middleware
  schema.post(/^find/, async function(docs) {
    if (!docs) return;

    const processDoc = (doc) => {
      if (doc && typeof doc.getStatus === 'function') {
        doc._doc.status = doc.getStatus();
        doc._doc.remainingDays = doc.getRemainingDays();
      }
    };

    if (Array.isArray(docs)) {
      docs.forEach(processDoc);
    } else {
      processDoc(docs);
    }
  });
};