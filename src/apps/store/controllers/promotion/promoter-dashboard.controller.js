import { PromotionTrackingModel } from '../../models/promotion/index.js';
import { OrderModel } from '../../models/order/order.model.js';
import { StoreModel } from '../../models/store/index.js';

export const getStorePromoterDashboard = async (req, res) => {
  try {
    const promoterId = req.userId;

    const [trackingStats, recentConversions] = await Promise.all([
      PromotionTrackingModel.aggregate([
        { $match: { promoter: new (require('mongoose').Types.ObjectId)(promoterId), isActive: true } },
        { $group: {
          _id: null,
          totalViews: { $sum: '$viewCount' },
          totalClicks: { $sum: '$clickCount' },
          totalConversions: { $sum: '$conversionCount' },
          totalEarnings: { $sum: '$earnings' },
          activePromotions: { $sum: { $cond: ['$isActive', 1, 0] } },
        }},
      ]).then(r => r[0] || { totalViews: 0, totalClicks: 0, totalConversions: 0, totalEarnings: 0, activePromotions: 0 }),

      PromotionTrackingModel.find({ promoter: promoterId, isActive: true })
        .sort({ lastActivityAt: -1 })
        .limit(5)
        .populate('product', 'name price images')
        .populate('store', 'name')
        .lean(),
    ]);

    const overallConvRate = trackingStats.totalClicks > 0
      ? Math.round((trackingStats.totalConversions / trackingStats.totalClicks) * 100) : 0;

    return res.json({
      success: true,
      data: {
        overview: {
          ...trackingStats,
          overallConversionRate: overallConvRate,
        },
        recentPromotions: recentConversions.map(r => ({
          _id: r._id,
          productName: r.product?.name || 'Unknown',
          productImage: r.product?.images?.[0]?.url || null,
          storeName: r.store?.name || 'Unknown',
          clicks: r.clickCount,
          conversions: r.conversionCount,
          earnings: r.earnings,
          trackingCode: r.uniqueCode,
        })),
      },
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};
