import { OrderModel } from '../../models/order/order.model.js';
import { ProductModel } from '../../models/promotion/index.js';
import { PromotionTrackingModel } from '../../models/promotion/index.js';
import mongoose from 'mongoose';

export const getStorefrontAnalytics = async (req, res) => {
  try {
    const marketerId = req.userId;
    const { days = 30 } = req.query;
    const since = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);

    const [orderStats, topProducts, topPromoters] = await Promise.all([
      OrderModel.aggregate([
        { $match: { marketer: new mongoose.Types.ObjectId(marketerId), placedAt: { $gte: since }, paymentStatus: 'paid' } },
        { $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          totalCommission: { $sum: '$totalPromoterCommission' },
          averageOrderValue: { $avg: '$totalAmount' },
        }},
      ]).then(r => r[0] || { totalOrders: 0, totalRevenue: 0, totalCommission: 0, averageOrderValue: 0 }),

      ProductModel.aggregate([
        { $match: { createdBy: new mongoose.Types.ObjectId(marketerId), isPublished: true } },
        { $sort: { purchaseCount: -1 } },
        { $limit: 5 },
        { $project: { name: 1, price: 1, purchaseCount: 1, images: 1 } },
      ]),

      PromotionTrackingModel.aggregate([
        { $match: { store: { $exists: true }, isActive: true } },
        { $lookup: { from: 'stores', localField: 'store', foreignField: '_id', as: 'storeDoc' } },
        { $unwind: '$storeDoc' },
        { $match: { 'storeDoc.owner': new mongoose.Types.ObjectId(marketerId) } },
        { $group: {
          _id: '$promoter',
          totalConversions: { $sum: '$conversionCount' },
          totalEarnings: { $sum: '$earnings' },
          clickToConvRate: { $avg: { $cond: [{ $gt: ['$clickCount', 0] }, { $divide: ['$conversionCount', '$clickCount'] }, 0] } },
        }},
        { $sort: { totalEarnings: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: '$user' },
        { $project: { displayName: '$user.displayName', promoterTier: '$user.promoterTier', totalConversions: 1, totalEarnings: 1, clickToConvRate: 1 } },
      ]),
    ]);

    return res.json({
      success: true,
      data: {
        overview: {
          ...orderStats,
          gmv: orderStats.totalRevenue,
          periodDays: parseInt(days),
        },
        topProducts: topProducts.map(p => ({ _id: p._id, name: p.name, price: p.price, purchaseCount: p.purchaseCount, image: p.images?.[0]?.url })),
        topPromoters,
      },
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};
