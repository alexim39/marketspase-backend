import { computePromoterTier } from '../../promotion/services/promoter-tier.service.js';
import { UserModel } from '../models/user/index.js';
import { PromotionModel } from '../../promotion/models/index.js';
import { CampaignModel } from '../../campaign/models/campaign.model.js';
import { LandingEventModel } from '../../campaign/models/landing-event.model.js';

// Get promoter tier + stats
export const getPromoterTier = async (req, res) => {
  try {
    const { userId } = req.params;
    const tier = await computePromoterTier(userId);
    return res.json({ success: true, data: { tier } });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

// Get promoter quality score for marketers (trust metrics)
export const getPromoterTrustMetrics = async (req, res) => {
  try {
    const { promoterId } = req.params;
    const [stats, completedPromotions] = await Promise.all([
      LandingEventModel.aggregate([
        { $match: { promoter: new (require('mongoose').Types.ObjectId)(promoterId) } },
        { $group: {
          _id: null,
          totalClicks: { $sum: { $cond: [{ $eq: ['$event', 'landing_view'] }, 1, 0] } },
          totalLeads: { $sum: { $cond: [{ $eq: ['$event', 'lead_success'] }, 1, 0] } },
        }},
      ]).then(r => r[0] || { totalClicks: 0, totalLeads: 0 }),

      PromotionModel.countDocuments({ promoter: promoterId, status: { $in: ['paid', 'validated'] } }),
    ]);

    const user = await UserModel.findById(promoterId).select('displayName avatar promoterTier collaborationRating').lean();

    return res.json({
      success: true,
      data: {
        tier: user?.promoterTier || 'unranked',
        rating: user?.collaborationRating || 0,
        totalClicks: stats.totalClicks,
        totalLeads: stats.totalLeads,
        conversionRate: stats.totalClicks > 0 ? Math.round((stats.totalLeads / stats.totalClicks) * 100) : 0,
        completedPromotions,
      },
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

// Bulk invite — invite multiple promoters to a campaign
export const bulkInvitePromoters = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { promoterIds } = req.body;

    if (!Array.isArray(promoterIds) || !promoterIds.length) {
      return res.status(400).json({ success: false, message: 'promoterIds array required.' });
    }

    const campaign = await CampaignModel.findOne({ _id: campaignId, owner: req.userId });
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found.' });

    let invited = 0;
    for (const pid of promoterIds.slice(0, 50)) {
      try {
        await require('../../campaign/controllers/accept-campaign.controller.js').acceptCampaignDirect({
          campaignId: campaign._id.toString(),
          userId: pid,
          req,
        });
        invited++;
      } catch (e) { /* skip duplicates */ }
    }

    return res.json({ success: true, data: { invited, total: promoterIds.length } });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};
