import { StoreModel } from '../models/store.model.js';
import { ProductModel, PromotionTrackingModel } from '../models/product.model.js';
import { StoreAnalyticsModel } from '../models/store-analytics.model.js';
import mongoose from 'mongoose';

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
    }).populate('owner', 'name email profilePicture');

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

/**
 * @desc    Get store products with filters
 * @route   GET /api/stores/:storeId/products
 * @access  Public
 */
export const getStorefrontProducts = async (req, res) => {
  try {
    const { storeId } = req.params;
    const {
      page = 1,
      limit = 12,
      category,
      sortBy = 'newest',
      minPrice,
      maxPrice,
      inStock,
      featured,
      search
    } = req.query;

    // Validate store
    const store = await StoreModel.findById(storeId);
    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    // Build query
    const query = {
      store: storeId,
      isActive: true,
      isDeleted: { $ne: true }
    };

    // Apply filters
    if (category) {
      query.category = category;
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    if (inStock === 'true') {
      query.$or = [
        { manageStock: false },
        { manageStock: true, quantity: { $gt: 0 } }
      ];
    }

    if (featured === 'true') {
      query.isFeatured = true;
    }

    // Apply search
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
        { 'attributes.values': { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort options
    let sortOptions = {};
    switch (sortBy) {
      case 'price-low':
        sortOptions = { price: 1 };
        break;
      case 'price-high':
        sortOptions = { price: -1 };
        break;
      case 'popular':
        sortOptions = { purchaseCount: -1 };
        break;
      case 'rating':
        sortOptions = { averageRating: -1 };
        break;
      case 'featured':
        sortOptions = { isFeatured: -1, createdAt: -1 };
        break;
      default: // 'newest'
        sortOptions = { createdAt: -1 };
    }

    // Execute query with pagination
    const skip = (Number(page) - 1) * Number(limit);
    
    const [products, total] = await Promise.all([
      ProductModel.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(Number(limit))
        .select('name description price originalPrice images category tags quantity manageStock lowStockAlert averageRating ratingCount viewCount purchaseCount isActive isFeatured createdAt updatedAt'),
      ProductModel.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / Number(limit));

    res.status(200).json({
      success: true,
      data: products,
      total,
      page: Number(page),
      totalPages
    });
  } catch (error) {
    console.error('Get store products error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * @desc    Get store categories
 * @route   GET /api/stores/:storeId/categories
 * @access  Public
 */
export const getStoreCategories = async (req, res) => {
  try {
    const { storeId } = req.params;

    const categories = await ProductModel.distinct('category', {
      store: storeId,
      isActive: true,
      isDeleted: { $ne: true }
    });

    res.status(200).json({
      success: true,
      data: categories.filter(Boolean) // Remove null/empty values
    });
  } catch (error) {
    console.error('Get store categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

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
 * @desc    Search stores
 * @route   GET /api/stores/search
 * @access  Public
 */
export const searchStores = async (req, res) => {
  try {
    const { query, page = 1, limit = 10 } = req.query;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters'
      });
    }

    const searchQuery = {
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { category: { $regex: query, $options: 'i' } }
      ],
      isVerified: true,
      isDeleted: { $ne: true }
    };

    const skip = (Number(page) - 1) * Number(limit);

    const [stores, total] = await Promise.all([
      StoreModel.find(searchQuery)
        .sort({ 'analytics.totalViews': -1, 'analytics.totalSales': -1 })
        .skip(skip)
        .limit(Number(limit))
        .select('name description logo category isVerified verificationTier storeLink analytics createdAt'),
      StoreModel.countDocuments(searchQuery)
    ]);

    const totalPages = Math.ceil(total / Number(limit));

    res.status(200).json({
      success: true,
      data: stores,
      total,
      page: Number(page),
      totalPages
    });
  } catch (error) {
    console.error('Search stores error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * @desc    Get trending stores
 * @route   GET /api/stores/trending
 * @access  Public
 */
export const getTrendingStores = async (req, res) => {
  try {
    const { limit = 8 } = req.query;

    const stores = await StoreModel.find({
      isVerified: true,
      isDeleted: { $ne: true },
      'analytics.totalViews': { $gt: 0 }
    })
    .sort({ 'analytics.totalViews': -1, 'analytics.conversionRate': -1 })
    .limit(Number(limit))
    .select('name description logo category isVerified verificationTier storeLink analytics')
    .populate('owner', 'name profilePicture');

    res.status(200).json({
      success: true,
      data: stores
    });
  } catch (error) {
    console.error('Get trending stores error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * @desc    Check store link availability
 * @route   GET /api/stores/check-link/:storeLink
 * @access  Public
 */
export const checkStoreLinkAvailability = async (req, res) => {
  try {
    const { storeLink } = req.params;

    if (!storeLink) {
      return res.status(400).json({
        success: false,
        message: 'Store link is required'
      });
    }

    // Check if link exists
    const existingStore = await StoreModel.findOne({
      storeLink,
      isDeleted: { $ne: true }
    });

    // Check if link meets requirements
    const isValid = /^[a-z0-9-]+$/.test(storeLink);
    const isTooShort = storeLink.length < 3;
    const isTooLong = storeLink.length > 50;
    const isReserved = ['admin', 'api', 'store', 'dashboard', 'promoter'].includes(storeLink);

    res.status(200).json({
      available: !existingStore && isValid && !isTooShort && !isTooLong && !isReserved,
      suggestions: existingStore ? await generateLinkSuggestions(storeLink) : []
    });
  } catch (error) {
    console.error('Check store link availability error:', error);
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
 * @desc    Get store verification status
 * @route   GET /api/stores/:storeId/verification-status
 * @access  Public
 */
export const getStoreVerificationStatus = async (req, res) => {
  try {
    const { storeId } = req.params;

    const store = await StoreModel.findById(storeId).select('isVerified verificationTier verificationDate');

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    res.status(200).json({
      verified: store.isVerified,
      tier: store.verificationTier,
      verificationDate: store.verificationDate
    });
  } catch (error) {
    console.error('Get verification status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
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
    await StoreAnalyticsModel.findOneAndUpdate(
      { store: storeId, 'dailyViews.date': today },
      {
        $inc: {
          'dailyViews.$.views': type === 'view' ? 1 : 0,
          'dailyViews.$.uniqueVisitors': type === 'view' && !referrer ? 1 : 0,
          'dailyViews.$.promoterTraffic': referrer ? 1 : 0
        }
      },
      { upsert: true, new: true }
    );
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