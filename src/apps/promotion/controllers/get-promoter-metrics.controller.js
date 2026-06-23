import mongoose from 'mongoose';
import { ensureSelfOrAdmin, getAuthenticatedUserId } from '../../../shared/utils/request-auth.util.js';
import { LandingEventModel } from '../../campaign/models/landing-event.model.js';

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

export const getPromoterMetrics = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid promoter ID.' });
    }

    if (!getAuthenticatedUserId(req)) {
      return res.status(401).json({ success: false, message: 'Authentication is required.' });
    }

    if (!ensureSelfOrAdmin(req, userId, res, 'Not allowed to access these metrics.')) {
      return;
    }

    const promoterOid = new mongoose.Types.ObjectId(userId);
    const { startDate, endDate, range } = req.query;
    const dateFilter = buildDateFilter(range, startDate, endDate);

    const matchStage = {
      promoter: promoterOid,
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

    const summary = {
      totalViews: campaignBreakdown.reduce((s, r) => s + r.landingViews, 0),
      totalLeads: campaignBreakdown.reduce((s, r) => s + r.leads, 0),
      totalContactMe: campaignBreakdown.reduce((s, r) => s + r.contactMe, 0),
      totalFormViews: campaignBreakdown.reduce((s, r) => s + r.formViews, 0),
      totalFailures: campaignBreakdown.reduce((s, r) => s + r.failures, 0),
      campaignCount: campaignBreakdown.length,
    };

    let topCampaign = null;
    if (campaignBreakdown.length > 0) {
      topCampaign = await LandingEventModel.aggregate([
        { $match: { ...matchStage, event: 'lead_success' } },
        { $group: { _id: '$campaign', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 1 },
        { $lookup: { from: 'campaigns', localField: '_id', foreignField: '_id', as: 'c' } },
        { $unwind: { path: '$c', preserveNullAndEmptyArrays: true } },
        { $project: { _id: 0, campaignId: '$_id', title: { $ifNull: ['$c.title', 'Unknown'] }, count: 1 } },
      ]).then((r) => r[0] || null);
    }

    return res.json({
      success: true,
      data: { summary, campaignBreakdown, topCampaign },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get promoter metrics error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to load metrics.' });
  }
};

export const getPromoterMetricsDetail = async (req, res) => {
  try {
    const { userId, campaignId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(campaignId)) {
      return res.status(400).json({ success: false, message: 'Invalid ID provided.' });
    }

    if (!getAuthenticatedUserId(req)) {
      return res.status(401).json({ success: false, message: 'Authentication is required.' });
    }

    if (!ensureSelfOrAdmin(req, userId, res, 'Not allowed to access these metrics.')) {
      return;
    }

    const promoterOid = new mongoose.Types.ObjectId(userId);
    const campaignOid = new mongoose.Types.ObjectId(campaignId);
    const { startDate, endDate, range } = req.query;
    const dateFilter = buildDateFilter(range, startDate, endDate);

    const matchStage = {
      promoter: promoterOid,
      campaign: campaignOid,
      event: { $in: ['landing_view', 'contact_me_select', 'form_view', 'lead_success', 'lead_failure'] },
    };
    if (dateFilter) matchStage.createdAt = dateFilter;

    const [campaign, promotionBreakdown, dailySeries] = await Promise.all([
      mongoose.model('Campaign').findById(campaignOid).select('title status').lean(),

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
          $project: {
            _id: 0,
            promotionId: { $ifNull: ['$_id', null] },
            upi: { $ifNull: ['$promotion.upi', ''] },
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
        { $project: { _id: 0, date: '$_id', landingViews: 1, contactMe: 1, formViews: 1, leads: 1, failures: 1 } },
      ]),
    ]);

    const totalViews = promotionBreakdown.reduce((s, r) => s + (r.landingViews || 0), 0);
    const totalLeads = promotionBreakdown.reduce((s, r) => s + (r.leads || 0), 0);

    return res.json({
      success: true,
      data: {
        campaign: {
          campaignId: campaign._id,
          title: campaign?.title || 'Unknown',
          status: campaign?.status || 'unknown',
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
    console.error('Get promoter metrics detail error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to load metrics.' });
  }
};
