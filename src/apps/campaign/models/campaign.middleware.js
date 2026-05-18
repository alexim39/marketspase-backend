import { formatDuration, calculateDaysBetween } from "./campaign.utils.js";
import { removeSearchEntity, scheduleSearchEntitySync } from "../../search/services/search-index.service.js";

export const setupCampaignMiddleware = (schema) => {
  // Pre-save middleware
  schema.pre('save', function(next) {
    // Check if campaign is expired
    if (this.hasEndDate && this.endDate) {
      const now = new Date();
      if (now > new Date(this.endDate)) {
        this.status = 'expired';
      }
    }

    // Set duration text
    if (this.startDate && this.endDate && this.hasEndDate) {
      const diffDays = calculateDaysBetween(this.startDate, this.endDate);
      this.duration = formatDuration(diffDays);
    } else {
      this.duration = 'Ongoing';
    }

    // Add creation activity for new campaigns
    if (this.isNew) {
      this.activityLog.push({
        action: 'Campaign Created',
        details: `Campaign "${this.title}" created with budget ${this.currency} ${this.budget}`,
        timestamp: new Date(),
        performedBy: this.owner
      });
    }

    next();
  });

  // Pre-findOneAndUpdate middleware
  schema.pre('findOneAndUpdate', function(next) {
    const update = this.getUpdate();
    
    // Add updatedAt timestamp
    update.updatedAt = new Date();
    
    // If status is being updated, add to activity log
    if (update.status) {
      this._oldStatus = this._conditions._id ? 
        this.model.findOne(this._conditions).select('status') : null;
    }
    
    next();
  });

  // Post-save middleware for budget exhaustion notifications
  schema.post('save', async function(doc) {
    if (doc._justExhausted) {
      await doc.logNotification('budget_exhausted', doc.owner, {
        spentBudget: doc.spentBudget,
        budget: doc.budget,
        exhaustedAt: new Date()
      });
      await doc.save();
      delete doc._justExhausted;
    }

    if (doc?._id) {
      scheduleSearchEntitySync('campaign', doc._id);
    }
  });

  // Post-findOneAndUpdate middleware
  schema.post('findOneAndUpdate', async function(doc) {
    if (doc && this._oldStatus && this._oldStatus !== doc.status) {
      doc.activityLog.push({
        action: 'Status Changed',
        details: `Status changed from ${this._oldStatus} to ${doc.status}`,
        timestamp: new Date()
      });
      await doc.save();
    }

    if (doc?._id) {
      scheduleSearchEntitySync('campaign', doc._id);
    }
  });

  schema.post('updateOne', function() {
    const query = this.getQuery();
    if (query?._id) {
      scheduleSearchEntitySync('campaign', query._id);
    }
  });

  schema.post('findOneAndDelete', function(doc) {
    if (doc?._id) {
      removeSearchEntity('campaign', doc._id).catch((error) => {
        console.warn('[global-search] failed to remove campaign search document:', error.message);
      });
    }
  });
};
