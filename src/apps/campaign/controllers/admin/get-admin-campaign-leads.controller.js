import { CustomerModel } from '../../../customer-crm/models/customer.model.js';

export const getAdminCampaignLeads = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;
    const search = req.query.search?.trim() || '';
    const campaignId = req.query.campaignId || '';
    const startDate = req.query.startDate || '';
    const endDate = req.query.endDate || '';

    const filter = { source: 'campaign_lead', isActive: true };

    if (campaignId) {
      const { default: mongoose } = await import('mongoose');
      if (mongoose.Types.ObjectId.isValid(campaignId)) {
        filter.campaignId = new mongoose.Types.ObjectId(campaignId);
      }
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    let searchFilter = { ...filter };
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      searchFilter = {
        ...filter,
        $or: [
          { displayName: regex },
          { phone: regex },
          { email: regex },
        ],
      };
    }

    const total = await CustomerModel.countDocuments(searchFilter);

    const [leads, stats] = await Promise.all([
      CustomerModel.find(searchFilter)
        .populate('campaignId', 'title status')
        .populate({
          path: 'promotionId',
          select: 'upi promoter',
          populate: { path: 'promoter', select: 'displayName username avatar' },
        })
        .populate('marketer', 'displayName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      CustomerModel.aggregate([
        { $match: filter },
        {
          $facet: {
            week: [
              { $match: { createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
              { $count: 'count' },
            ],
            today: [
              {
                $match: {
                  createdAt: {
                    $gte: new Date(new Date().setHours(0, 0, 0, 0)),
                  },
                },
              },
              { $count: 'count' },
            ],
            byCampaign: [
              { $group: { _id: '$campaignId', count: { $sum: 1 } } },
              { $sort: { count: -1 } },
              { $limit: 1 },
              {
                $lookup: { from: 'campaigns', localField: '_id', foreignField: '_id', as: 'c' },
              },
              { $unwind: { path: '$c', preserveNullAndEmptyArrays: true } },
              { $project: { _id: 0, campaignId: '$_id', title: { $ifNull: ['$c.title', 'Unknown'] }, count: 1 } },
            ],
            byPromoter: [
              { $group: { _id: '$promotionId', count: { $sum: 1 } } },
              { $sort: { count: -1 } },
              { $limit: 1 },
              {
                $lookup: { from: 'promotions', localField: '_id', foreignField: '_id', as: 'p' },
              },
              { $unwind: { path: '$p', preserveNullAndEmptyArrays: true } },
              { $project: { _id: 0, promoId: '$_id', promoterId: '$p.promoter', count: 1 } },
            ],
          },
        },
      ]).then(async ([result]) => {
        const leadStats = {
          totalLeads: total,
          weekLeads: result.week[0]?.count || 0,
          todayLeads: result.today[0]?.count || 0,
          topCampaign: result.byCampaign[0] || null,
          topPromoter: null,
        };
        if (result.byPromoter[0]?.promoterId) {
          const { default: mongoose } = await import('mongoose');
          const UserModel = mongoose.model('User');
          const user = await UserModel.findById(result.byPromoter[0].promoterId)
            .select('displayName username')
            .lean();
          leadStats.topPromoter = {
            promoterId: result.byPromoter[0].promoterId,
            name: user?.displayName || user?.username || 'Unknown',
            count: result.byPromoter[0].count,
          };
        }
        return leadStats;
      }),
    ]);

    return res.json({
      success: true,
      data: {
        leads: leads.map(l => ({
          _id: l._id,
          displayName: l.displayName || 'Unknown',
          phone: l.phone || '',
          email: l.email || '',
          campaignId: l.campaignId?._id || l.campaignId || null,
          campaignTitle: l.campaignId?.title || 'Unknown',
          campaignStatus: l.campaignId?.status || 'unknown',
          promotionUpi: l.promotionId?.upi || null,
          promoterId: l.promotionId?.promoter?._id || null,
          promoterName: l.promotionId?.promoter?.displayName || l.promotionId?.promoter?.username || null,
          marketerId: l.marketer?._id || l.marketer || null,
          marketerName: l.marketer?.displayName || 'Unknown',
          marketerEmail: l.marketer?.email || '',
          lifecycleStage: l.lifecycleStage || 'new',
          tags: l.tags || [],
          consent: l.consent || {},
          createdAt: l.createdAt,
        })),
        stats,
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    });
  } catch (error) {
    console.error('Admin campaign leads error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to load leads.' });
  }
};

export const deleteAdminCampaignLead = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, message: 'Lead ID required.' });

    const { default: mongoose } = await import('mongoose');
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid lead ID.' });
    }

    const result = await CustomerModel.deleteOne({ _id: id, source: 'campaign_lead' });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Lead not found.' });
    }

    return res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error('Admin delete lead error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to delete lead.' });
  }
};
