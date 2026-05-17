import mongoose from "mongoose";
import { THRESHOLDS } from "./campaign.constants.js";

export const setupCampaignStatics = (schema) => {
  // Find campaigns that need budget alerts
  schema.statics.findCampaignsNeedingBudgetAlerts = async function(thresholdPercentage = THRESHOLDS.BUDGET_ALERT_PERCENTAGE) {
    return this.find({
      status: 'active',
      $expr: {
        $and: [
          { $gte: [{ $multiply: [{ $divide: ['$spentBudget', '$budget'] }, 100] }, thresholdPercentage] },
          { $lt: ['$budgetAlerts.lastAlertPercentage', thresholdPercentage] }
        ]
      }
    }).populate('owner');
  };

  // Find campaigns approaching deadline
  schema.statics.findCampaignsApproachingDeadline = async function(daysThreshold = THRESHOLDS.DEADLINE_APPROACHING_DAYS) {
    const thresholdDate = new Date(Date.now() + daysThreshold * 24 * 60 * 60 * 1000);
    
    return this.find({
      status: 'active',
      hasEndDate: true,
      endDate: { $lte: thresholdDate, $gte: new Date() }
    }).populate('owner');
  };

  // Mark campaigns as expired
  schema.statics.markExpiredCampaigns = async function() {
    const now = new Date();
    const Promotion = mongoose.model("Promotion");

    const campaigns = await this.find({
      hasEndDate: true,
      endDate: { $lt: now },
      status: 'active'
    });

    if (!campaigns.length) {
      return { matched: 0, modified: 0 };
    }

    const ids = campaigns.map((c) => c._id);

    const result = await this.updateMany(
      { _id: { $in: ids } },
      {
        $set: { status: 'expired' },
        $push: {
          activityLog: {
            action: 'Status Changed',
            details: 'Auto-expired by scheduler: endDate passed.',
            timestamp: new Date()
          }
        }
      }
    );

    await Promotion.updateMany(
      { campaign: { $in: ids }, isActive: true },
      { $set: { isActive: false } }
    );

    return {
      matched: result.matchedCount ?? result.n,
      modified: result.modifiedCount ?? result.nModified
    };
  };

  // Mark campaigns as exhausted
  schema.statics.markExhaustedCampaigns = async function() {
    const Promotion = mongoose.model("Promotion");
    const campaigns = await this.find({
      status: 'active',
      $expr: {
        $lt: [
          { $subtract: ['$budget', { $ifNull: ['$spentBudget', 0] }] },
          { $ifNull: ['$costPerClick', '$payoutPerPromotion'] }
        ]
      }
    });

    if (!campaigns.length) {
      return { matched: 0, modified: 0 };
    }

    const ids = campaigns.map((c) => c._id);

    const result = await this.updateMany(
      { _id: { $in: ids } },
      {
        $set: { status: 'exhausted' },
        $push: {
          activityLog: {
            action: 'Status Changed',
            details: 'Auto-exhausted by scheduler: budget fully paid out.',
            timestamp: new Date()
          }
        }
      }
    );

    await Promotion.updateMany(
      { campaign: { $in: ids }, isActive: true },
      { $set: { isActive: false } }
    );

    return {
      matched: result.matchedCount ?? result.n,
      modified: result.modifiedCount ?? result.nModified
    };
  };

  // Find campaigns by targeting criteria
  schema.statics.findByTargeting = async function(user, limit = 20) {
    const query = {
      status: 'active',
      isDeleted: false,
      $expr: {
        $gt: [
          { $subtract: ['$budget', { $ifNull: ['$spentBudget', 0] }] },
          { $ifNull: ['$costPerClick', '$payoutPerPromotion'] }
        ]
      }
    };

    if (user.rating) {
      query.minRating = { $lte: user.rating };
    }

    return this.find(query)
      .sort({ priority: -1, createdAt: -1 })
      .limit(limit)
      .populate('owner', 'username displayName avatar rating');
  };

  // Get campaign statistics
  schema.statics.getStats = async function(query = {}) {
    const stats = await this.aggregate([
      { $match: query },
      { $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalBudget: { $sum: '$budget' },
        totalSpent: { $sum: '$spentBudget' },
        totalPromotions: { $sum: '$totalPromotions' },
        avgCostPerClick: { $avg: { $ifNull: ['$costPerClick', '$payoutPerPromotion'] } }
      }}
    ]);

    const total = await this.countDocuments(query);

    return {
      total,
      byStatus: stats
    };
  };
};
