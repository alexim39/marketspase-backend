import { LandingEventModel } from '../../models/landing-event.model.js';

export const getAdminCampaignMetrics = async (req, res) => {
  try {
    const { startDate, endDate, range } = req.query;
    const dateFilter = buildDateFilter(range, startDate, endDate);

    const matchStage = {
      event: { $in: ['landing_view', 'contact_me_select', 'form_view', 'lead_success', 'lead_failure'] },
    };
    if (dateFilter) matchStage.createdAt = dateFilter;

    // First, get the campaign breakdown
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

    // Then compute summary, top campaign, top promoter
    const [summary, topCampaign, topPromoter] = await Promise.all([
      LandingEventModel.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalViews: { $sum: { $cond: [{ $eq: ['$event', 'landing_view'] }, 1, 0] } },
            totalLeads: { $sum: { $cond: [{ $eq: ['$event', 'lead_success'] }, 1, 0] } },
            totalFailures: { $sum: { $cond: [{ $eq: ['$event', 'lead_failure'] }, 1, 0] } },
            totalContactMe: { $sum: { $cond: [{ $eq: ['$event', 'contact_me_select'] }, 1, 0] } },
            totalFormViews: { $sum: { $cond: [{ $eq: ['$event', 'form_view'] }, 1, 0] } },
          },
        },
      ]).then(r => r[0] || { totalViews: 0, totalLeads: 0, totalFailures: 0, totalContactMe: 0, totalFormViews: 0 }),

      campaignBreakdown.length > 0
        ? LandingEventModel.aggregate([
            { $match: { ...matchStage, event: 'lead_success' } },
            { $group: { _id: '$campaign', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 1 },
            { $lookup: { from: 'campaigns', localField: '_id', foreignField: '_id', as: 'c' } },
            { $unwind: { path: '$c', preserveNullAndEmptyArrays: true } },
            { $project: { _id: 0, campaignId: '$_id', title: { $ifNull: ['$c.title', 'Unknown'] }, count: 1 } },
          ]).then(r => r[0] || null)
        : Promise.resolve(null),

      LandingEventModel.aggregate([
        { $match: { ...matchStage, event: 'lead_success', promoter: { $ne: null } } },
        { $group: { _id: '$promoter', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 1 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
        { $unwind: { path: '$u', preserveNullAndEmptyArrays: true } },
        { $project: { _id: 0, promoterId: '$_id', name: { $ifNull: ['$u.displayName', 'Unknown'] }, count: 1 } },
      ]).then(r => r[0] || null),
    ]);

    const conversionRate = summary.totalViews > 0
      ? Math.round((summary.totalLeads / summary.totalViews) * 100)
      : 0;

    return res.json({
      success: true,
      data: {
        summary: { ...summary, conversionRate },
        campaignBreakdown,
        topCampaign,
        topPromoter,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Admin campaign metrics error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to load metrics.' });
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
