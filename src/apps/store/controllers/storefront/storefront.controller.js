import { StoreModel } from '../../models/store/index.js';
import { ProductModel, PromotionTrackingModel } from '../../models/promotion/index.js';
import { StoreAnalyticsModel } from '../../models/store-analytics/index.js';
import mongoose from 'mongoose';



/**
 * @desc    Increment store views
 * @route   POST /api/stores/:storeId/views
 * @access  Public
 */
export const incrementStoreViews = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { referrer } = req.body;

    await StoreModel.findByIdAndUpdate(storeId, {
      $inc: { 'analytics.totalViews': 1 },
      $currentDate: { updatedAt: true }
    });

    // Update daily analytics
    await updateDailyAnalytics(storeId, 'view', referrer);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Increment store views error:', error);
    res.status(500).json({ success: false });
  }
};

/**
 * @desc    Get store analytics
 * @route   GET /api/stores/:storeId/analytics
 * @access  Private (Store Owner)
 */
export const getStoreAnalytics = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { period = 'month' } = req.query;

    // Verify store ownership
    if (req.user._id.toString() !== store.owner.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view store analytics'
      });
    }

    const analytics = await getStoreAnalyticsData(storeId, period);

    res.status(200).json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Get store analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};


/**
 * @desc    Track store interaction
 * @route   POST /api/stores/:storeId/interactions
 * @access  Public
 */
export const trackStoreInteraction = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { interaction } = req.body;

    if (!['click', 'share', 'save'].includes(interaction)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid interaction type'
      });
    }

    // Update interaction analytics
    await updateDailyAnalytics(storeId, interaction);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Track store interaction error:', error);
    res.status(500).json({ success: false });
  }
};

/**
 * @desc    Get store by store link
 * @route   GET /api/stores/link/:storeLink
 * @access  Public
 */
export const getStoreByLink = async (req, res) => {
  try {
    const { storeLink } = req.params;
    const { includeAnalytics = 'true' } = req.query;
    
    if (!storeLink) {
      return res.status(400).json({
        success: false,
        message: 'Store link is required'
      });
    }

    // Find store by link
    const store = await StoreModel.findOne({ 
      storeLink,
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

    // Get popular products
    const popularProducts = await ProductModel
      .find({ 
        store: store._id,
        isActive: true,
        isDeleted: { $ne: true }
      })
      .sort({ purchaseCount: -1 })
      .limit(6)
      .select('name price images category averageRating ratingCount purchaseCount');

    // Increment view count
    await StoreModel.findByIdAndUpdate(store._id, {
      $inc: { 'analytics.totalViews': 1 }
    });

    // Track referrer if provided
    if (req.headers.referer) {
      await trackStoreReferral(store._id, req.headers.referer);
    }

    // Get owner details
    const ownerDetails = store.owner ? {
      name: store.owner.name,
      email: store.owner.email,
      profilePicture: store.owner.profilePicture
    } : null;

    const responseData = {
      ...store.toObject(),
      followerCount: store.followers?.length || 0,
      ownerDetails
    };

    res.status(200).json({
      success: true,
      data: responseData,
      analytics: analytics || undefined,
      popularProducts: popularProducts.length > 0 ? popularProducts : undefined
    });
  } catch (error) {
    console.error('Get store by link error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


// Helper Functions

/**
 * Get store analytics data
 */
const getStoreAnalyticsData = async (storeId, period = 'month') => {
  const store = await StoreModel.findById(storeId).select('analytics');
  
  // Calculate date range based on period
  const now = new Date();
  let startDate = new Date();
  
  switch (period) {
    case 'day':
      startDate.setDate(now.getDate() - 1);
      break;
    case 'week':
      startDate.setDate(now.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(now.getMonth() - 1);
      break;
    case 'year':
      startDate.setFullYear(now.getFullYear() - 1);
      break;
  }

  // Get analytics data
  const [analyticsDoc, topProducts, promoterPerformance] = await Promise.all([
    StoreAnalyticsModel.findOne({ store: storeId }),
    getTopProducts(storeId, startDate),
    getPromoterPerformance(storeId, startDate)
  ]);

  // Calculate daily views for the period
  const dailyViews = await calculateDailyViews(storeId, startDate, now);

  return {
    dailyViews,
    salesData: {
      totalRevenue: store?.analytics?.totalSales || 0,
      promoterDrivenSales: await calculatePromoterDrivenSales(storeId),
      conversionRate: store?.analytics?.conversionRate || 0,
      topProducts
    },
    promoterPerformance
  };
};

/**
 * Get top products for store
 */
const getTopProducts = async (storeId, startDate) => {
  const products = await ProductModel.aggregate([
    {
      $match: {
        store: new mongoose.Types.ObjectId(storeId),
        isActive: true,
        isDeleted: { $ne: true },
        purchaseCount: { $gt: 0 }
      }
    },
    {
      $sort: { purchaseCount: -1 }
    },
    {
      $limit: 10
    },
    {
      $project: {
        _id: 1,
        name: 1,
        price: 1,
        images: { $slice: ['$images', 1] },
        category: 1,
        purchaseCount: 1,
        revenue: { $multiply: ['$price', '$purchaseCount'] }
      }
    }
  ]);

  return products.map(product => ({
    product: {
      _id: product._id,
      name: product.name,
      price: product.price,
      image: product.images[0]?.url,
      category: product.category
    },
    sales: product.purchaseCount,
    revenue: product.revenue
  }));
};

/**
 * Get promoter performance for store
 */
const getPromoterPerformance = async (storeId, startDate) => {
  const performance = await PromotionTrackingModel.aggregate([
    {
      $match: {
        store: new mongoose.Types.ObjectId(storeId),
        isActive: true,
        isApproved: true,
        conversionCount: { $gt: 0 }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'promoter',
        foreignField: '_id',
        as: 'promoter'
      }
    },
    {
      $unwind: '$promoter'
    },
    {
      $group: {
        _id: '$promoter._id',
        promoter: { $first: '$promoter' },
        clicks: { $sum: '$clickCount' },
        conversions: { $sum: '$conversionCount' },
        commissionEarned: { $sum: '$earnings' }
      }
    },
    {
      $sort: { conversions: -1 }
    },
    {
      $project: {
        'promoter._id': 1,
        'promoter.name': 1,
        'promoter.profilePicture': 1,
        clicks: 1,
        conversions: 1,
        commissionEarned: 1
      }
    }
  ]);

  return performance;
};

/**
 * Calculate daily views
 */
const calculateDailyViews = async (storeId, startDate, endDate) => {
  // This would typically come from your analytics service
  // For now, return mock data or implement based on your analytics model
  const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
  const dailyViews = [];
  
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    
    // Mock data - replace with actual analytics query
    dailyViews.push({
      date: date.toISOString().split('T')[0],
      views: Math.floor(Math.random() * 100) + 50,
      uniqueVisitors: Math.floor(Math.random() * 80) + 30,
      promoterTraffic: Math.floor(Math.random() * 40) + 10
    });
  }
  
  return dailyViews;
};

/**
 * Calculate promoter driven sales
 */
const calculatePromoterDrivenSales = async (storeId) => {
  const result = await PromotionTrackingModel.aggregate([
    {
      $match: {
        store: new mongoose.Types.ObjectId(storeId),
        isActive: true,
        isApproved: true
      }
    },
    {
      $group: {
        _id: null,
        totalSales: { $sum: '$conversionCount' }
      }
    }
  ]);
  
  return result.length > 0 ? result[0].totalSales : 0;
};

/**
 * Update daily analytics
 */
const updateDailyAnalytics = async (storeId, type, referrer = null) => {
  const today = new Date().toISOString().split('T')[0];

  try {
    // 1. Try to update an existing daily entry
    const updated = await StoreAnalyticsModel.findOneAndUpdate(
      { store: storeId, 'dailyViews.date': today },  // ✅ Changed from 'storeId' to 'store'
      {
        $inc: {
          'dailyViews.$.views': type === 'view' ? 1 : 0,
          'dailyViews.$.uniqueVisitors': type === 'view' && !referrer ? 1 : 0,
          'dailyViews.$.promoterTraffic': referrer ? 1 : 0
        }
      },
      { new: true }
    );

    // 2. If no entry existed, push a new one
    if (!updated) {
      await StoreAnalyticsModel.findOneAndUpdate(
        { store: storeId },  // ✅ Changed from 'storeId' to 'store'
        {
          $push: {
            dailyViews: {
              date: today,
              views: type === 'view' ? 1 : 0,
              uniqueVisitors: type === 'view' && !referrer ? 1 : 0,
              promoterTraffic: referrer ? 1 : 0
            }
          }
        },
        { upsert: true, new: true }
      );
    }
  } catch (error) {
    console.error('Update daily analytics error:', error);
  }
};

/**
 * Track store referral
 */
const trackStoreReferral = async (storeId, referrer) => {
  // Extract domain from referrer
  try {
    const referrerUrl = new URL(referrer);
    const domain = referrerUrl.hostname;
    
    // Check if it's a promoter link
    if (domain.includes('marketspase.com')) {
      // Extract promoter info from URL if available
      await updateDailyAnalytics(storeId, 'view', true);
    }
  } catch (error) {
    // Invalid URL, ignore
  }
};

/**
 * Generate link suggestions
 */
const generateLinkSuggestions = async (storeLink) => {
  const suggestions = [];
  const baseLink = storeLink.replace(/[^a-z0-9-]/g, '');
  
  for (let i = 1; i <= 5; i++) {
    const suggestion = `${baseLink}-${Math.floor(Math.random() * 1000)}`;
    const exists = await StoreModel.findOne({ storeLink: suggestion });
    
    if (!exists) {
      suggestions.push(suggestion);
    }
    
    if (suggestions.length >= 3) break;
  }
  
  return suggestions;
};
