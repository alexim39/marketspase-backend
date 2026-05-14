import { StoreModel } from '../../models/store/index.js';
import { ProductModel } from '../../models/promotion/index.js';
import { StoreAnalyticsModel } from '../../models/store-analytics/index.js';
import { OrderModel, PAYMENT_STATUS as ORDER_PAYMENT_STATUS } from '../../models/order/index.js';
import mongoose from 'mongoose';
import { getStoreReviewStats, mergeStoreRatingAnalytics } from '../../services/review-aggregate.service.js';
/**
 * @desc    Get store by ID with analytics
 * @route   GET /api/stores/:storeId
 * @access  Public
 */
export const getStoreById = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { includeAnalytics = 'true', includeProducts = 'false' } = req.query;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: 'Store ID is required'
      });
    }

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(storeId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid store ID format'
      });
    }

    // Find store by ID
    const store = await StoreModel.findOne({ 
      _id: storeId,
      isDeleted: { $ne: true }
    }).populate('owner', 'displayName email personalInfo.phone avatar');

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    // Get store analytics if requested
    let analytics = null;
    if (includeAnalytics === 'true') {
      analytics = await getStoreAnalyticsData(store);
    }

    // Get store products if requested
    let products = null;
    if (includeProducts === 'true') {
      products = await ProductModel.find({
        store: storeId,
        isActive: true,
        isDeleted: { $ne: true }
      })
      .sort({ isFeatured: -1, createdAt: -1 })
      .limit(12)
      .select('name price images category averageRating ratingCount isFeatured');
    }

    // Get product count
    const productCount = await ProductModel.countDocuments({
      store: storeId,
      isActive: true,
      isDeleted: { $ne: true }
    });

    // Get featured products count
    const featuredCount = await ProductModel.countDocuments({
      store: storeId,
      isFeatured: true,
      isActive: true,
      isDeleted: { $ne: true }
    });

    // Format owner details
    const ownerDetails = store.owner ? {
      name: store.owner.displayName || store.owner.name,
      email: store.owner.email,
      phone: store.owner.personalInfo?.phone,
      avatar: store.owner.avatar
    } : null;

    const reviewStats = await getStoreReviewStats(storeId);
    const responseData = {
      ...mergeStoreRatingAnalytics(store, reviewStats),
      followerCount: store.followers?.length || 0,
      owner: ownerDetails,
      statistics: {
        productCount,
        featuredCount,
        followerCount: store.followers?.length || 0,
        rating: reviewStats.averageRating,
        totalReviews: reviewStats.totalReviews,
        ...analytics
      }
    };

    res.status(200).json({
      success: true,
      data: responseData,
      products: products || undefined
    });
  } catch (error) {
    console.error('Get store by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Helper function to get store analytics data
 */
const getStoreAnalyticsData = async (store) => {
  try {
    const storeId = store?._id || store;
    const [analytics, productTotals, orderTotals] = await Promise.all([
      StoreAnalyticsModel.findOne({ store: storeId }).lean(),
      ProductModel.aggregate([
        {
          $match: {
            store: new mongoose.Types.ObjectId(storeId),
            isActive: true,
            isDeleted: { $ne: true }
          }
        },
        {
          $group: {
            _id: null,
            totalProductViews: { $sum: { $ifNull: ['$viewCount', 0] } },
            totalProductSales: { $sum: { $ifNull: ['$purchaseCount', 0] } }
          }
        }
      ]),
      OrderModel.aggregate([
        {
          $match: {
            store: new mongoose.Types.ObjectId(storeId),
            paymentStatus: ORDER_PAYMENT_STATUS.PAID,
            isDeleted: { $ne: true }
          }
        },
        {
          $unwind: {
            path: '$items',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $group: {
            _id: '$_id',
            itemSales: { $sum: { $ifNull: ['$items.quantity', 0] } },
            revenue: { $first: '$totalAmount' }
          }
        },
        {
          $group: {
            _id: null,
            orderCount: { $sum: 1 },
            totalItemSales: { $sum: '$itemSales' },
            totalRevenue: { $sum: '$revenue' }
          }
        }
      ])
    ]);

    // Calculate recent trends (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentDailyViews = analytics?.dailyViews?.filter(
      d => new Date(d.date) >= thirtyDaysAgo
    ) || [];

    const allDailyViews = analytics?.dailyViews || [];
    const dailyViewTotal = allDailyViews.reduce((sum, d) => sum + (d.views || 0), 0);
    const dailyPromoterTraffic = allDailyViews.reduce((sum, d) => sum + (d.promoterTraffic || 0), 0);
    const recentViews = recentDailyViews.reduce((sum, d) => sum + (d.views || 0), 0);
    const recentUnique = recentDailyViews.reduce((sum, d) => sum + (d.uniqueVisitors || 0), 0);
    const recentPromoter = recentDailyViews.reduce((sum, d) => sum + (d.promoterTraffic || 0), 0);
    const productStats = productTotals[0] || {};
    const orderStats = orderTotals[0] || {};
    const totalViews = Math.max(
      toNumber(store?.analytics?.totalViews),
      dailyViewTotal,
      toNumber(productStats.totalProductViews)
    );
    const totalSales = Math.max(
      toNumber(productStats.totalProductSales),
      toNumber(orderStats.totalItemSales),
      toNumber(orderStats.orderCount)
    );
    const conversionRate = totalViews > 0
      ? (totalSales / totalViews) * 100
      : toNumber(store?.analytics?.conversionRate ?? analytics?.salesData?.conversionRate);
    const promoterTraffic = Math.max(
      toNumber(store?.analytics?.promoterTraffic),
      dailyPromoterTraffic,
      toNumber(analytics?.salesData?.promoterDrivenSales)
    );

    return {
      totalViews,
      totalSales,
      conversionRate,
      promoterTraffic,
      totalRevenue: toNumber(orderStats.totalRevenue, analytics?.salesData?.totalRevenue || 0),
      recentStats: {
        views: recentViews,
        uniqueVisitors: recentUnique,
        promoterTraffic: recentPromoter,
        period: '30days'
      },
      topProducts: analytics?.salesData?.topProducts?.slice(0, 5) || []
    };
  } catch (error) {
    console.error('Get store analytics error:', error);
    return {
      totalViews: toNumber(store?.analytics?.totalViews),
      totalSales: toNumber(store?.analytics?.totalSales),
      conversionRate: toNumber(store?.analytics?.conversionRate),
      promoterTraffic: toNumber(store?.analytics?.promoterTraffic)
    };
  }
};

const toNumber = (value, fallback = 0) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};
