import { StoreModel } from '../../models/store/index.js';
import { ProductModel } from '../../models/promotion/index.js';
import { StoreAnalyticsModel } from '../../models/store-analytics/index.js';
import mongoose from 'mongoose';
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
      analytics = await getStoreAnalyticsData(store._id);
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

    const responseData = {
      ...store.toObject(),
      owner: ownerDetails,
      statistics: {
        productCount,
        featuredCount,
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
const getStoreAnalyticsData = async (storeId) => {
  try {
    const analytics = await StoreAnalyticsModel.findOne({ store: storeId });
    
    if (!analytics) {
      return {
        totalViews: 0,
        totalSales: 0,
        conversionRate: 0,
        promoterTraffic: 0
      };
    }

    // Calculate recent trends (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentDailyViews = analytics.dailyViews?.filter(
      d => new Date(d.date) >= thirtyDaysAgo
    ) || [];

    const recentViews = recentDailyViews.reduce((sum, d) => sum + (d.views || 0), 0);
    const recentUnique = recentDailyViews.reduce((sum, d) => sum + (d.uniqueVisitors || 0), 0);
    const recentPromoter = recentDailyViews.reduce((sum, d) => sum + (d.promoterTraffic || 0), 0);

    return {
      totalViews: analytics.salesData?.totalRevenue || 0,
      totalSales: analytics.salesData?.totalRevenue || 0,
      conversionRate: analytics.salesData?.conversionRate || 0,
      promoterTraffic: analytics.salesData?.promoterDrivenSales || 0,
      recentStats: {
        views: recentViews,
        uniqueVisitors: recentUnique,
        promoterTraffic: recentPromoter,
        period: '30days'
      },
      topProducts: analytics.salesData?.topProducts?.slice(0, 5) || []
    };
  } catch (error) {
    console.error('Get store analytics error:', error);
    return null;
  }
};