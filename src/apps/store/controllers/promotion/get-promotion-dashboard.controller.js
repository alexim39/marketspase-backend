import mongoose from 'mongoose';
import { OrderModel, PAYMENT_STATUS as ORDER_PAYMENT_STATUS } from '../../models/order/index.js';
import { PromotionTrackingModel } from '../../models/promotion/index.js';
import { buildAffiliateUrl } from '../../services/storefront-affiliate.service.js';

export const getPromotionDashboard = async (req, res) => {
  try {
    const { promoterId } = req.query;

    if (!promoterId || !mongoose.Types.ObjectId.isValid(promoterId)) {
      return res.status(400).json({
        success: false,
        message: 'A valid promoterId is required'
      });
    }

    const promoterObjectId = new mongoose.Types.ObjectId(promoterId);
    const [promotions, orderSummary] = await Promise.all([
      PromotionTrackingModel.find({
        promoter: promoterObjectId,
        isActive: true
      })
        .populate('product', 'name price currency images category slug isActive isPublished')
        .populate('store', 'name logo storeLink')
        .sort({ lastActivityAt: -1, createdAt: -1 })
        .lean(),
      OrderModel.aggregate([
        {
          $match: {
            'items.promoterId': promoterObjectId,
            paymentStatus: ORDER_PAYMENT_STATUS.PAID,
            isDeleted: false
          }
        },
        { $unwind: '$items' },
        { $match: { 'items.promoterId': promoterObjectId } },
        {
          $group: {
            _id: null,
            totalSales: { $sum: 1 },
            totalRevenue: { $sum: '$items.totalPrice' },
            totalCommission: { $sum: '$items.commissionEarned' },
            reservedCommission: {
              $sum: {
                $cond: [{ $eq: ['$escrowStatus', 'held'] }, '$items.commissionEarned', 0]
              }
            },
            releasedCommission: {
              $sum: {
                $cond: [{ $eq: ['$escrowStatus', 'released'] }, '$items.commissionEarned', 0]
              }
            },
            pendingReleaseRequests: {
              $sum: {
                $cond: [{ $eq: ['$releaseRequest.status', 'requested'] }, 1, 0]
              }
            }
          }
        }
      ])
    ]);

    const transformedPromotions = promotions.map((promotion) => {
      const viewCount = promotion.viewCount || 0;
      const clickCount = promotion.clickCount || 0;
      const conversionCount = promotion.conversionCount || 0;
      const clickThroughRate = viewCount > 0 ? (clickCount / viewCount) * 100 : 0;
      const conversionRate = clickCount > 0 ? (conversionCount / clickCount) * 100 : 0;
      const productImage = promotion.product?.images?.[0]?.url || null;

      return {
        trackingId: promotion._id,
        productId: promotion.product?._id,
        productName: promotion.product?.name || 'Unknown Product',
        productPrice: promotion.product?.price || 0,
        currency: promotion.product?.currency || 'NGN',
        productImage,
        productCategory: promotion.product?.category,
        store: promotion.store || null,
        uniqueCode: promotion.uniqueCode,
        uniqueId: promotion.uniqueId,
        affiliateUrl: buildAffiliateUrl(req, promotion.uniqueCode),
        views: viewCount,
        clicks: clickCount,
        conversions: conversionCount,
        earnings: promotion.earnings || 0,
        clickThroughRate,
        conversionRate,
        commissionRate: promotion.commissionRate || 0,
        commissionType: promotion.commissionType || 'percentage',
        fixedCommission: promotion.fixedCommission || 0,
        averageOrderValue: promotion.averageOrderValue || 0,
        deviceTypes: promotion.deviceTypes || { mobile: 0, desktop: 0, tablet: 0 },
        referralSources: promotion.referralSources || [],
        createdAt: promotion.createdAt,
        lastActivityAt: promotion.lastActivityAt || promotion.createdAt,
        isActive: promotion.isActive === true,
        performance: calculatePerformanceRating({ conversionRate, earnings: promotion.earnings || 0, clicks: clickCount, views: viewCount })
      };
    });

    const totals = transformedPromotions.reduce((acc, promotion) => {
      acc.totalEarnings += promotion.earnings;
      acc.totalClicks += promotion.clicks;
      acc.totalConversions += promotion.conversions;
      acc.totalViews += promotion.views;
      return acc;
    }, {
      totalEarnings: 0,
      totalClicks: 0,
      totalConversions: 0,
      totalViews: 0
    });
    const sales = orderSummary[0] || {
      totalSales: 0,
      totalRevenue: 0,
      totalCommission: 0,
      reservedCommission: 0,
      releasedCommission: 0,
      pendingReleaseRequests: 0
    };

    return res.status(200).json({
      success: true,
      data: {
        ...totals,
        activePromotions: transformedPromotions.length,
        avgConversionRate: transformedPromotions.length
          ? transformedPromotions.reduce((sum, p) => sum + p.conversionRate, 0) / transformedPromotions.length
          : 0,
        avgClickThroughRate: transformedPromotions.length
          ? transformedPromotions.reduce((sum, p) => sum + p.clickThroughRate, 0) / transformedPromotions.length
          : 0,
        sales,
        promotions: transformedPromotions,
        performanceBreakdown: {
          high: transformedPromotions.filter(p => p.performance === 'high').length,
          medium: transformedPromotions.filter(p => p.performance === 'medium').length,
          low: transformedPromotions.filter(p => p.performance === 'low').length
        }
      }
    });
  } catch (error) {
    console.error('Error fetching promotion dashboard:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch promotion dashboard'
    });
  }
};

function calculatePerformanceRating(stats) {
  const { conversionRate, earnings, clicks, views } = stats;
  const ctr = views > 0 ? (clicks / views) * 100 : 0;

  if (conversionRate >= 5 || earnings > 10000 || ctr >= 10) return 'high';
  if (conversionRate < 1 && earnings < 1000 && clicks < 10) return 'low';
  return 'medium';
}
