import mongoose from 'mongoose';
import { ensureSelfOrAdmin, getAuthenticatedUserId } from '../../../shared/utils/request-auth.util.js';
import { LandingEventModel } from '../models/landing-event.model.js';
import { CampaignModel } from '../models/campaign.model.js';

export const getMarketerLeadAnalytics = async (req, res) => {
  try {
    if (!getAuthenticatedUserId(req)) {
      return res.status(401).json({ success: false, message: 'Authentication is required.' });
    }
    if (!ensureSelfOrAdmin(req, req.userId, res, 'Not allowed to access these lead analytics.')) {
      return;
    }

    const marketerId = req.userId;
    const { campaignId, startDate, endDate, range } = req.query;

    if (!mongoose.Types.ObjectId.isValid(marketerId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID.' });
    }

    const marketerOid = new mongoose.Types.ObjectId(marketerId);

    // Find all campaigns owned by this marketer
    const ownedCampaigns = await CampaignModel.find({ owner: marketerOid })
      .select('_id')
      .lean();
    const ownedIds = ownedCampaigns.map(c => c._id);

    if (ownedIds.length === 0) {
      return res.json({
        success: true,
        data: { campaignBreakdown: [], topCampaign: null, topPromoter: null },
        generatedAt: new Date().toISOString(),
      });
    }

    // If a specific campaignId filter is provided, intersect with owned ids
    let campaignFilter = { $in: ownedIds };
    if (campaignId && mongoose.Types.ObjectId.isValid(campaignId)) {
      const requestedOid = new mongoose.Types.ObjectId(campaignId);
      if (!ownedIds.some(id => id.equals(requestedOid))) {
        return res.json({
          success: true,
          data: { campaignBreakdown: [], topCampaign: null, topPromoter: null },
          generatedAt: new Date().toISOString(),
        });
      }
      campaignFilter = requestedOid;
    }

    const dateFilter = buildDateFilter(range, startDate, endDate);

    const matchStage = {
      campaign: campaignFilter,
      event: { $in: ['landing_view', 'contact_me_select', 'form_view', 'lead_success', 'lead_failure'] },
    };
    if (dateFilter) matchStage.createdAt = dateFilter;

    const campaignBreakdown = await LandingEventModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$campaign',
          landingViews: { $sum: { $cond: [{ $eq: ['$event', 'landing_view'] }, 1, 0] } },
          contactMe: { $sum: { $cond: [{ $eq: ['$event', 'contact_me_select'] }, 1, 0] } },
          formViews: { $sum: { $cond: [{ $eq: ['$event', 'form_view'] }, 1, 0] } },
          leads: { $sum: { $cond: [{ $eq: ['$event', 'lead_success'] }, 1, 0] } },
          failures: { $sum: { $cond: [{ $eq: ['$event', 'lead_failure'] }, 1, 0] } },
        },
      },
      { $sort: { leads: -1 } },
      {
        $lookup: { from: 'campaigns', localField: '_id', foreignField: '_id', as: 'campaign' },
      },
      { $unwind: { path: '$campaign', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          campaignId: '$_id',
          title: { $ifNull: ['$campaign.title', 'Unknown'] },
          status: { $ifNull: ['$campaign.status', 'unknown'] },
          landingViews: 1,
          contactMe: 1,
          formViews: 1,
          leads: 1,
          failures: 1,
          conversionRate: {
            $cond: [
              { $gt: ['$landingViews', 0] },
              { $round: [{ $multiply: [{ $divide: ['$leads', '$landingViews'] }, 100] }, 0] },
              0,
            ],
          },
        },
      },
    ]);

    let topCampaign = null;
    let topPromoter = null;

    if (campaignBreakdown.length > 0) {
      const [topC, topP] = await Promise.all([
        LandingEventModel.aggregate([
          { $match: matchStage },
          { $group: { _id: '$campaign', count: { $sum: { $cond: [{ $eq: ['$event', 'lead_success'] }, 1, 0] } } } },
          { $sort: { count: -1 } },
          { $limit: 1 },
          {
            $lookup: { from: 'campaigns', localField: '_id', foreignField: '_id', as: 'campaign' },
          },
          { $unwind: { path: '$campaign', preserveNullAndEmptyArrays: true } },
          { $project: { _id: 0, campaignId: '$_id', title: { $ifNull: ['$campaign.title', 'Unknown'] }, count: 1 } },
        ]).then(r => r[0] || null),

        LandingEventModel.aggregate([
          {
            $match: {
              ...matchStage,
              event: 'lead_success',
              promoter: { $ne: null },
            },
          },
          { $group: { _id: '$promoter', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 1 },
          {
            $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' },
          },
          { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
          {
            $project: {
              _id: 0,
              promoterId: '$_id',
              name: { $ifNull: ['$user.displayName', 'Unknown'] },
              avatar: '$user.avatar',
              count: 1,
            },
          },
        ]).then(r => r[0] || null),
      ]);
      topCampaign = topC;
      topPromoter = topP;
    }

    return res.json({
      success: true,
      data: { campaignBreakdown, topCampaign, topPromoter },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get marketer lead analytics error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to load lead analytics.' });
  }
};

function buildDateFilter(range, startDate, endDate) {
  if (range === 'custom' && (startDate || endDate)) {
    const filter = {};
    if (startDate) filter.$gte = new Date(startDate);
    if (endDate) filter.$lte = new Date(endDate);
    return filter;
  }
  if (range && range !== 'custom') {
    const days = parseInt(range, 10) || 30;
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);
    return { $gte: since };
  }
  return null;
}
