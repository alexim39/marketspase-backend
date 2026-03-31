import mongoose from "mongoose";
import { NEWSLETTER_STATUS, CLEANUP } from "./newsletter.constants.js";

export const setupNewsletterStatics = (schema) => {
  // Find active newsletters
  schema.statics.findActive = function() {
    return this.find({ isActive: true, isDeleted: false });
  };

  // Find by status
  schema.statics.findByStatus = function(status) {
    return this.find({ status, isDeleted: false });
  };

  // Find scheduled newsletters that need to be sent
  schema.statics.findScheduledForSending = function() {
    const now = new Date();
    return this.find({
      status: NEWSLETTER_STATUS.SCHEDULED,
      scheduledDate: { $lte: now },
      isDeleted: false
    }).populate('createdBy', 'username email');
  };

  // Get newsletter statistics
  schema.statics.getStats = async function() {
    const stats = await this.aggregate([
      { $match: { isDeleted: false } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          draft: { 
            $sum: { $cond: [{ $eq: ['$status', NEWSLETTER_STATUS.DRAFT] }, 1, 0] } 
          },
          scheduled: { 
            $sum: { $cond: [{ $eq: ['$status', NEWSLETTER_STATUS.SCHEDULED] }, 1, 0] } 
          },
          sending: { 
            $sum: { $cond: [{ $eq: ['$status', NEWSLETTER_STATUS.SENDING] }, 1, 0] } 
          },
          sent: { 
            $sum: { $cond: [{ $eq: ['$status', NEWSLETTER_STATUS.SENT] }, 1, 0] } 
          },
          failed: { 
            $sum: { $cond: [{ $eq: ['$status', NEWSLETTER_STATUS.FAILED] }, 1, 0] } 
          },
          totalSent: { 
            $sum: { $cond: [{ $eq: ['$status', NEWSLETTER_STATUS.SENT] }, '$actualRecipients', 0] } 
          },
          avgOpenRate: { $avg: '$openRate' },
          avgClickRate: { $avg: '$clickRate' },
          totalOpens: { $sum: '$totalOpens' },
          totalClicks: { $sum: '$totalClicks' }
        }
      }
    ]);
    
    return stats[0] || {
      total: 0,
      draft: 0,
      scheduled: 0,
      sending: 0,
      sent: 0,
      failed: 0,
      totalSent: 0,
      avgOpenRate: 0,
      avgClickRate: 0,
      totalOpens: 0,
      totalClicks: 0
    };
  };

  // Get recipient counts by type
  schema.statics.getRecipientCounts = async function() {
    const UserModel = mongoose.model('User');
    
    const [allUsers, marketers, promoters] = await Promise.all([
      UserModel.countDocuments({ isActive: true, isDeleted: false }),
      UserModel.countDocuments({ role: 'marketer', isActive: true, isDeleted: false }),
      UserModel.countDocuments({ role: 'promoter', isActive: true, isDeleted: false })
    ]);
    
    return {
      all: allUsers,
      marketers,
      promoters
    };
  };

  // Find newsletters with best performance
  schema.statics.findTopPerformers = function(limit = 10) {
    return this.find({ 
      status: NEWSLETTER_STATUS.SENT, 
      isDeleted: false 
    })
    .sort({ openRate: -1, clickRate: -1 })
    .limit(limit)
    .select('title subject openRate clickRate uniqueOpens uniqueClicks sentDate');
  };

  // Clean up old soft-deleted newsletters
  schema.statics.cleanupOldDeleted = async function() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - CLEANUP.SOFT_DELETE_DAYS);
    
    return this.deleteMany({
      isDeleted: true,
      deletedAt: { $lt: cutoffDate }
    });
  };

  // Find newsletters by recipient type
  schema.statics.findByRecipientType = function(recipientType, limit = 50) {
    return this.find({ 
      recipientType, 
      isDeleted: false 
    })
    .sort({ createdAt: -1 })
    .limit(limit);
  };

  // Get campaign performance
  schema.statics.getCampaignPerformance = async function(campaignId) {
    return this.aggregate([
      { $match: { campaignId, isDeleted: false } },
      {
        $group: {
          _id: null,
          totalNewsletters: { $sum: 1 },
          totalRecipients: { $sum: '$actualRecipients' },
          avgOpenRate: { $avg: '$openRate' },
          avgClickRate: { $avg: '$clickRate' },
          totalOpens: { $sum: '$totalOpens' },
          totalClicks: { $sum: '$totalClicks' },
          newsletters: { $push: '$$ROOT' }
        }
      }
    ]);
  };

  // Search newsletters
  schema.statics.search = async function(query, options = {}) {
    const { limit = 20, skip = 0 } = options;

    const newsletters = await this.find({
      $text: { $search: query },
      isDeleted: false
    })
      .populate('createdBy', 'username displayName')
      .sort({ score: { $meta: 'textScore' } })
      .limit(limit)
      .skip(skip)
      .lean();

    const total = await this.countDocuments({
      $text: { $search: query },
      isDeleted: false
    });

    return {
      newsletters,
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + newsletters.length < total
      }
    };
  };
};