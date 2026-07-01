import mongoose from 'mongoose';
import { CampaignModel } from '../../campaign/models/campaign.model.js';
import { OrderModel } from '../../store/models/order/index.js';
import { UserModel } from '../../user/models/user/index.js';

const { ObjectId } = mongoose.Types;

const requireMarketerRole = (req, res) => {
  if (!req.user || req.user.role !== 'marketer') {
    res.status(403).json({ success: false, message: 'Access denied. Marketer role required.' });
    return false;
  }
  return true;
};

export const getUnifiedAnalytics = async (req, res) => {
  try {
    if (!requireMarketerRole(req, res)) return;

    const marketerId = req.userId;
    const days = Math.max(1, Math.min(parseInt(req.query.days, 10) || 30, 365));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [campaignStatsResult, storeStatsResult, user, topCampaigns, topProducts] = await Promise.all([
      CampaignModel.aggregate([
        { $match: { owner: new ObjectId(marketerId), createdAt: { $gte: since } } },
        {
          $group: {
            _id: null,
            totalCampaigns: { $sum: 1 },
            activeCount: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
            totalBudget: { $sum: '$budget' },
            totalSpent: { $sum: '$spentBudget' },
            totalClicks: { $sum: '$totalClicks' },
            totalBillableClicks: { $sum: '$billableClicks' },
            totalPayouts: { $sum: '$totalPayouts' },
          },
        },
      ]),

      OrderModel.aggregate([
        {
          $match: {
            marketer: new ObjectId(marketerId),
            placedAt: { $gte: since },
            paymentStatus: 'paid',
          },
        },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalRevenue: { $sum: '$totalAmount' },
            totalCommission: { $sum: '$totalPromoterCommission' },
            averageOrderValue: { $avg: '$totalAmount' },
          },
        },
      ]),

      UserModel.findById(marketerId).select('wallets').lean(),

      CampaignModel.find({ owner: new ObjectId(marketerId), createdAt: { $gte: since } })
        .select('title budget spentBudget billableClicks status')
        .sort({ billableClicks: -1 })
        .limit(5)
        .lean(),

      OrderModel.aggregate([
        {
          $match: {
            marketer: new ObjectId(marketerId),
            placedAt: { $gte: since },
            paymentStatus: 'paid',
          },
        },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.product',
            totalSold: { $sum: '$items.quantity' },
            revenue: { $sum: '$items.totalPrice' },
          },
        },
        { $sort: { totalSold: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'product',
          },
        },
        { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            name: { $ifNull: ['$product.name', 'Unknown Product'] },
            image: { $first: { $ifNull: ['$product.images.url', []] } },
            totalSold: 1,
            revenue: 1,
          },
        },
      ]),
    ]);

    const campaignDefaults = { total: 0, active: 0, totalBudget: 0, totalSpent: 0, totalClicks: 0, billableClicks: 0, totalPayouts: 0 };
    const campaignAgg = campaignStatsResult[0] || {};
    const campaigns = {
      total: campaignAgg.totalCampaigns || 0,
      active: campaignAgg.activeCount || 0,
      totalBudget: campaignAgg.totalBudget || 0,
      totalSpent: campaignAgg.totalSpent || 0,
      totalClicks: campaignAgg.totalClicks || 0,
      billableClicks: campaignAgg.totalBillableClicks || 0,
      totalPayouts: campaignAgg.totalPayouts || 0,
    };

    const storeAgg = storeStatsResult[0] || {};
    const storefront = {
      totalOrders: storeAgg.totalOrders || 0,
      totalRevenue: storeAgg.totalRevenue || 0,
      totalCommission: storeAgg.totalCommission || 0,
      averageOrderValue: Math.round((storeAgg.averageOrderValue || 0) * 100) / 100,
    };

    const wallet = {
      available: user?.wallets?.marketer?.balance || 0,
      reserved: user?.wallets?.marketer?.reserved || 0,
      totalEarned: user?.wallets?.promoter?.balance || 0,
      total: (user?.wallets?.marketer?.balance || 0) + (user?.wallets?.marketer?.reserved || 0),
    };

    res.status(200).json({
      success: true,
      data: {
        period: {
          days,
          from: since.toISOString(),
          to: new Date().toISOString(),
        },
        campaigns,
        storefront,
        wallet,
        topCampaigns,
        topProducts,
      },
    });
  } catch (error) {
    console.error('Unified analytics error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch analytics data.' });
  }
};
