import mongoose from 'mongoose';
import { LandingEventModel } from '../../models/landing-event.model.js';
import { CampaignModel } from '../../models/campaign.model.js';

export const getAdminCampaignMetricsDetail = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { startDate, endDate, range } = req.query;

    if (!mongoose.Types.ObjectId.isValid(campaignId)) {
      return res.status(400).json({ success: false, message: 'Invalid campaign ID.' });
    }

    const campaignOid = new mongoose.Types.ObjectId(campaignId);

    const campaign = await CampaignModel.findById(campaignOid)
      .select('title status owner')
      .populate('owner', 'displayName username email avatar')
      .lean();

    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found.' });
    }

    const dateFilter = buildDateFilter(range, startDate, endDate);

    const matchStage = {
      campaign: campaignOid,
      event: { $in: ['landing_view', 'contact_me_select', 'form_view', 'lead_success', 'lead_failure'] },
    };
    if (dateFilter) matchStage.createdAt = dateFilter;

    const [promotionBreakdown, dailySeries] = await Promise.all([
      LandingEventModel.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$promotion',
            landingViews: { $sum: { $cond: [{ $eq: ['$event', 'landing_view'] }, 1, 0] } },
            contactMe: { $sum: { $cond: [{ $eq: ['$event', 'contact_me_select'] }, 1, 0] } },
            formViews: { $sum: { $cond: [{ $eq: ['$event', 'form_view'] }, 1, 0] } },
            leads: { $sum: { $cond: [{ $eq: ['$event', 'lead_success'] }, 1, 0] } },
            failures: { $sum: { $cond: [{ $eq: ['$event', 'lead_failure'] }, 1, 0] } },
          },
        },
        { $sort: { leads: -1 } },
        {
          $lookup: { from: 'promotions', localField: '_id', foreignField: '_id', as: 'promotion' },
        },
        { $unwind: { path: '$promotion', preserveNullAndEmptyArrays: true } },
        {
          $lookup: { from: 'users', localField: 'promotion.promoter', foreignField: '_id', as: 'promoter' },
        },
        { $unwind: { path: '$promoter', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            promotionId: { $ifNull: ['$_id', null] },
            upi: { $ifNull: ['$promotion.upi', ''] },
            promoterName: { $ifNull: ['$promoter.displayName', '$promoter.username', 'Unknown'] },
            promoterAvatar: '$promoter.avatar',
            landingViews: 1,
            contactMe: 1,
            formViews: 1,
            leads: 1,
            failures: 1,
          },
        },
      ]),

      LandingEventModel.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            landingViews: { $sum: { $cond: [{ $eq: ['$event', 'landing_view'] }, 1, 0] } },
            contactMe: { $sum: { $cond: [{ $eq: ['$event', 'contact_me_select'] }, 1, 0] } },
            formViews: { $sum: { $cond: [{ $eq: ['$event', 'form_view'] }, 1, 0] } },
            leads: { $sum: { $cond: [{ $eq: ['$event', 'lead_success'] }, 1, 0] } },
            failures: { $sum: { $cond: [{ $eq: ['$event', 'lead_failure'] }, 1, 0] } },
          },
        },
        { $sort: { _id: -1 } },
        {
          $project: {
            _id: 0,
            date: '$_id',
            landingViews: 1,
            contactMe: 1,
            formViews: 1,
            leads: 1,
            failures: 1,
          },
        },
      ]),
    ]);

    const totalViews = promotionBreakdown.reduce((s, r) => s + (r.landingViews || 0), 0);
    const totalLeads = promotionBreakdown.reduce((s, r) => s + (r.leads || 0), 0);

    return res.json({
      success: true,
      data: {
        campaign: {
          campaignId: campaign._id,
          title: campaign.title,
          status: campaign.status,
          marketer: campaign.owner ? {
            name: campaign.owner.displayName || campaign.owner.username,
            email: campaign.owner.email,
            avatar: campaign.owner.avatar,
          } : null,
        },
        summary: {
          totalViews,
          totalLeads,
          totalContactMe: promotionBreakdown.reduce((s, r) => s + (r.contactMe || 0), 0),
          totalFormViews: promotionBreakdown.reduce((s, r) => s + (r.formViews || 0), 0),
          totalFailures: promotionBreakdown.reduce((s, r) => s + (r.failures || 0), 0),
          conversionRate: totalViews > 0 ? Math.round((totalLeads / totalViews) * 100) : 0,
        },
        promotionBreakdown,
        dailySeries,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Admin campaign metrics detail error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to load analytics.' });
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
