import { ACTION_TO_CATEGORY } from "./activity.constants.js";

export const setupActivityStatics = (schema) => {
  // Log an activity (convenience method)
  schema.statics.log = async function(data) {
    const activity = new this(data);
    return activity.save();
  };

  // Find activities by user
  schema.statics.findByUser = function(userId, options = {}) {
    const { limit = 50, skip = 0, sort = { timestamp: -1 } } = options;
    return this.find({ userId })
      .limit(limit)
      .skip(skip)
      .sort(sort);
  };

  // Find activities by action type
  schema.statics.findByAction = function(action, options = {}) {
    const { limit = 50, skip = 0, startDate, endDate } = options;
    const query = { action };
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }
    
    return this.find(query)
      .limit(limit)
      .skip(skip)
      .sort({ timestamp: -1 });
  };

  // Find activities by resource
  schema.statics.findByResource = function(resourceType, resourceId, options = {}) {
    const { limit = 50, skip = 0 } = options;
    return this.find({ resourceType, resourceId })
      .limit(limit)
      .skip(skip)
      .sort({ timestamp: -1 });
  };

  // Find activities by category
  schema.statics.findByCategory = function(category, options = {}) {
    const { limit = 50, skip = 0, startDate, endDate } = options;
    
    // Get all actions for this category
    const actions = Object.keys(ACTION_TO_CATEGORY)
      .filter(action => ACTION_TO_CATEGORY[action] === category);
    
    const query = { action: { $in: actions } };
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }
    
    return this.find(query)
      .limit(limit)
      .skip(skip)
      .sort({ timestamp: -1 });
  };

  // Find activities by severity
  schema.statics.findBySeverity = function(severity, options = {}) {
    const { limit = 50, skip = 0 } = options;
    return this.find({ severity })
      .limit(limit)
      .skip(skip)
      .sort({ timestamp: -1 });
  };

  // Get activity statistics
  schema.statics.getStats = async function(query = {}) {
    const stats = await this.aggregate([
      { $match: query },
      { $group: {
        _id: '$action',
        count: { $sum: 1 },
        lastOccurrence: { $max: '$timestamp' }
      }},
      { $sort: { count: -1 } }
    ]);
    
    const total = await this.countDocuments(query);
    
    const severityStats = await this.aggregate([
      { $match: query },
      { $group: {
        _id: '$severity',
        count: { $sum: 1 }
      }}
    ]);
    
    const hourlyStats = await this.aggregate([
      { $match: query },
      { $group: {
        _id: {
          hour: { $hour: '$timestamp' },
          date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }
        },
        count: { $sum: 1 }
      }},
      { $sort: { '_id.date': -1, '_id.hour': 1 } }
    ]);
    
    return {
      total,
      byAction: stats,
      bySeverity: severityStats,
      hourly: hourlyStats
    };
  };

  // Clean up old activities (for GDPR compliance)
  schema.statics.cleanupOld = async function(daysToKeep = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    return this.deleteMany({
      timestamp: { $lt: cutoffDate }
    });
  };

  // Export activities for audit
  schema.statics.exportForAudit = async function(startDate, endDate) {
    const query = {};
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }
    
    return this.find(query)
      .sort({ timestamp: 1 })
      .lean();
  };
};