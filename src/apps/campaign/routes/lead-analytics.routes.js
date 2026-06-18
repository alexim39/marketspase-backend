import express from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware.js';
import { LandingEventModel } from '../models/landing-event.model.js';

const router = express.Router();
router.use(authenticate);

router.get('/stats', async (req, res) => {
  try {
    const marketerId = req.userId;

    const [summary, byCampaign, byPromoter, recentLeads] = await Promise.all([
      LandingEventModel.aggregate([
        { $match: { marketer: req.userId, event: { $in: ['landing_view', 'lead_success'] } } },
        { $group: {
          _id: null,
          totalViews: { $sum: { $cond: [{ $eq: ['$event', 'landing_view'] }, 1, 0] } },
          totalLeads: { $sum: { $cond: [{ $eq: ['$event', 'lead_success'] }, 1, 0] } },
          totalFailures: { $sum: { $cond: [{ $eq: ['$event', 'lead_failure'] }, 1, 0] } },
          totalContactMe: { $sum: { $cond: [{ $eq: ['$event', 'contact_me_select'] }, 1, 0] } },
          totalFormViews: { $sum: { $cond: [{ $eq: ['$event', 'form_view'] }, 1, 0] } },
        }},
      ]).then(r => r[0] || { totalViews: 0, totalLeads: 0, totalFailures: 0, totalContactMe: 0, totalFormViews: 0 }),

      LandingEventModel.aggregate([
        { $match: { marketer: req.userId, event: 'lead_success' } },
        { $group: { _id: '$campaign', count: { $sum: 1 } } },
        { $sort: { count: -1 } }, { $limit: 5 },
        { $lookup: { from: 'campaigns', localField: '_id', foreignField: '_id', as: 'campaign' } },
        { $unwind: { path: '$campaign', preserveNullAndEmptyArrays: true } },
        { $project: { campaignId: '$_id', title: { $ifNull: ['$campaign.title', 'Unknown'] }, count: 1 } },
      ]),

      LandingEventModel.aggregate([
        { $match: { marketer: req.userId, event: 'lead_success', promoter: { $ne: null } } },
        { $group: { _id: '$promoter', count: { $sum: 1 } } },
        { $sort: { count: -1 } }, { $limit: 5 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        { $project: { promoterId: '$_id', name: { $ifNull: ['$user.displayName', 'Unknown'] }, count: 1 } },
      ]),

      LandingEventModel.find({ marketer: req.userId, event: 'lead_success' })
        .sort({ createdAt: -1 }).limit(10)
        .populate('campaign', 'title')
        .populate('promoter', 'displayName')
        .lean(),
    ]);

    const conversionRate = summary.totalViews > 0
      ? Math.round((summary.totalLeads / summary.totalViews) * 100)
      : 0;

    return res.json({
      success: true,
      data: {
        summary: { ...summary, conversionRate },
        byCampaign,
        byPromoter,
        recentLeads: recentLeads.map(l => ({
          campaignName: l.campaign?.title || 'Unknown',
          promoterName: l.promoter?.displayName || 'Unknown',
          phone: l.phone ? l.phone.slice(-4) : null,
          createdAt: l.createdAt,
        })),
      },
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

export default router;
