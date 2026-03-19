import { PROMOTION_STATUS } from "./promotion.constants.js";

export const setupPromotionStatics = (schema) => {
  // Find active promotions for a campaign
  schema.statics.findActiveForCampaign = function(campaignId) {
    return this.find({
      campaign: campaignId,
      status: { $in: ['accepted', 'downloaded', 'submitted', 'validated'] }
    }).populate('promoter', 'username email displayName');
  };

  // Find promotions by promoter with filtering
  schema.statics.findByPromoter = function(promoterId, filters = {}) {
    const query = { promoter: promoterId };
    
    if (filters.status) {
      query.status = filters.status;
    }
    
    if (filters.campaign) {
      query.campaign = filters.campaign;
    }
    
    return this.find(query)
      .populate('campaign', 'name budget status')
      .sort({ createdAt: -1 });
  };

  // Find promotions by campaign with pagination
  schema.statics.findByCampaign = function(campaignId, options = {}) {
    const { limit = 50, skip = 0, status } = options;
    const query = { campaign: campaignId };
    
    if (status) {
      query.status = status;
    }
    
    return this.find(query)
      .populate('promoter', 'username displayName avatar')
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 });
  };

  // Get statistics for a campaign
  schema.statics.getCampaignStats = async function(campaignId) {
    const stats = await this.aggregate([
      { $match: { campaign: mongoose.Types.ObjectId(campaignId) } },
      { $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalPayout: { $sum: '$payoutAmount' }
      }}
    ]);
    
    const total = await this.countDocuments({ campaign: campaignId });
    
    return {
      total,
      byStatus: stats
    };
  };

  // Find promotions overdue for validation
  schema.statics.findOverdueForValidation = function(daysOverdue = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOverdue);
    
    return this.find({
      status: 'submitted',
      submittedAt: { $lte: cutoffDate }
    }).populate('campaign promoter');
  };

  // Find promotions needing submission reminders
  schema.statics.findNeedingSubmissionReminder = function() {
    const startHoursAgo = 20 * 60 * 60 * 1000; // 20 hours in ms
    const endHoursAgo = 24 * 60 * 60 * 1000; // 24 hours in ms
    
    const startTime = new Date(Date.now() - endHoursAgo);
    const endTime = new Date(Date.now() - startHoursAgo);
    
    return this.find({
      status: 'downloaded',
      downloadedAt: { $gte: startTime, $lte: endTime },
      'reminders.submission.lastSent': { $exists: false }
    }).populate('campaign promoter');
  };

  // Get promotion metrics
  schema.statics.getMetrics = async function(query = {}) {
    const metrics = await this.aggregate([
      { $match: query },
      { $group: {
        _id: null,
        totalPromotions: { $sum: 1 },
        totalPaid: { 
          $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] }
        },
        totalValidated: {
          $sum: { $cond: [{ $eq: ['$status', 'validated'] }, 1, 0] }
        },
        totalRejected: {
          $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] }
        },
        totalPayoutAmount: { $sum: '$payoutAmount' },
        averageProofViews: { $avg: '$proofViews' }
      }}
    ]);
    
    return metrics[0] || {
      totalPromotions: 0,
      totalPaid: 0,
      totalValidated: 0,
      totalRejected: 0,
      totalPayoutAmount: 0,
      averageProofViews: 0
    };
  };
};