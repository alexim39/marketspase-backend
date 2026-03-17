import mongoose from 'mongoose';
import { ProductModel } from '../../models/product.model.js';
import { StoreModel } from '../../models/store.model.js';
import { PromotionTrackingModel } from '../../models/product.model.js';

/**
 * @desc    Get product by ID with populated data
 * @route   GET /api/storefront/products/:productId
 * @access  Public
 */
export const getProductById = async (req, res) => {
  try {
    const { productId } = req.params;
    const { track = 'true' } = req.query;

    console.log('req params ', req.params);
    console.log('productId ', productId);
    console.log('track ', track);

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format'
      });
    }

    // Find product by ID with active status
    const product = await ProductModel.findOne({ 
      _id: productId,
      isActive: true,
      isDeleted: { $ne: true }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if product is scheduled and available
    const now = new Date();
    if (product.scheduledStart && product.scheduledStart > now) {
      return res.status(403).json({
        success: false,
        message: 'Product is not yet available',
        availableFrom: product.scheduledStart
      });
    }

    if (product.scheduledEnd && product.scheduledEnd < now) {
      return res.status(403).json({
        success: false,
        message: 'Product is no longer available'
      });
    }

    // Increment view count (if tracking enabled)
    if (track === 'true') {
      await ProductModel.findByIdAndUpdate(productId, {
        $inc: { viewCount: 1 }
      });
      product.viewCount += 1; // Update for response
    }

    // Get store information
    const store = await StoreModel.findById(product.store)
      .select('name logo storeLink isVerified verificationTier whatsappNumber analytics');

    // Get active promotions for this product
    const activePromotions = await PromotionTrackingModel.find({
      product: productId,
      isActive: true,
      isApproved: true,
      $or: [
        { endDate: { $exists: false } },
        { endDate: { $gt: new Date() } }
      ]
    }).populate('promoter', 'name');

    // Track referrer if provided (for promotion tracking)
    if (req.headers.referer && req.query.promoterId) {
      await trackPromotionClick(req, productId, req.query.promoterId, req.headers.referer);
    }

    // Calculate discount percentage
    const discountPercentage = product.originalPrice && product.originalPrice > product.price
      ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
      : 0;

    // Format response
    const responseData = {
      ...product.toObject(),
      store: store || null,
      discountPercentage,
      activePromotions: activePromotions.length > 0 ? activePromotions : undefined,
      isAvailable: !product.manageStock || product.quantity > 0
    };

    res.status(200).json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('Get product by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Helper function to track promotion clicks
 * @param {Object} req - Express request object
 * @param {string} productId - Product ID
 * @param {string} promoterId - Promoter ID
 * @param {string} referer - Referer URL
 */
const trackPromotionClick = async (req, productId, promoterId, referer) => {
  try {
    const tracking = await PromotionTrackingModel.findOne({
      product: productId,
      promoter: promoterId,
      isActive: true
    });

    if (tracking) {
      // Determine device type from user agent
      const deviceType = getDeviceType(req.headers['user-agent'] || '');
      
      await PromotionTrackingModel.findByIdAndUpdate(tracking._id, {
        $inc: { 
          clickCount: 1,
          [`deviceTypes.${deviceType}`]: 1
        },
        $push: {
          referralSources: {
            source: referer,
            count: 1
          }
        },
        lastActivityAt: new Date()
      });
    }
  } catch (error) {
    console.error('Track promotion click error:', error);
    // Non-critical error, don't throw
  }
};

/**
 * Helper to determine device type from user agent
 * @param {string} userAgent - User agent string
 * @returns {string} Device type (mobile, tablet, desktop)
 */
const getDeviceType = (userAgent) => {
  if (!userAgent) return 'desktop';
  
  const ua = userAgent.toLowerCase();
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobile))/i.test(ua)) {
    return 'tablet';
  }
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) {
    return 'mobile';
  }
  return 'desktop';
};