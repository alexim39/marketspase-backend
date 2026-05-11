import mongoose from 'mongoose';
import { StoreModel } from '../../models/store/index.js';
import { StoreAnalyticsModel } from '../../models/store-analytics/index.js';
import { PromotionTrackingModel, ProductModel } from '../../models/promotion/index.js';
import {
  calculateCommissionForAmount,
  detectDeviceType,
  getProductAffiliateSettings,
  roundMoney,
  upsertReferralSource
} from '../../services/storefront-affiliate.service.js';

/**
 * @desc    Get product by ID with populated data
 * @route   GET /api/storefront/products/:productId
 * @access  Public
 */
export const getProductById = async (req, res) => {
  try {
    const { productId } = req.params;
    const { track = 'true', ref, promoter, clicked, trackingCode } = req.query;

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

    // Increment product and store view counts when the product page is actually loaded.
    if (track !== 'false') {
      await ProductModel.findByIdAndUpdate(productId, {
        $inc: { viewCount: 1 }
      });
      product.viewCount += 1; // Update for response

      await recordStoreProductView(product.store, {
        promoterTraffic: Boolean(
          (track && track !== 'true' && track !== 'false')
          || trackingCode
          || ref
          || promoter
          || clicked === '1'
        )
      });
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

    let activePromotion = null;
    if (track && track !== 'true') {
      activePromotion = await PromotionTrackingModel.findOne({
        product: productId,
        uniqueCode: track,
        isActive: true,
      });

      if (activePromotion) {
        const deviceType = detectDeviceType(req.headers['user-agent'] || '');
        activePromotion.viewCount += 1;
        activePromotion.lastActivityAt = new Date();
        activePromotion.deviceTypes[deviceType] += 1;
        activePromotion.referralSources = upsertReferralSource(
          activePromotion.referralSources,
          req.headers.referer || 'direct'
        );
        if (activePromotion.viewCount > 0) {
          activePromotion.clickThroughRate = (activePromotion.clickCount / activePromotion.viewCount) * 100;
        }
        await activePromotion.save();
      }
    } else if (ref || trackingCode) {
      activePromotion = await PromotionTrackingModel.findOne({
        product: productId,
        isActive: true,
        $or: [
          ...(ref ? [{ uniqueId: ref }] : []),
          ...(trackingCode ? [{ uniqueCode: trackingCode }] : [])
        ]
      });
    }

    // Calculate discount percentage
    const discountPercentage = product.originalPrice && product.originalPrice > product.price
      ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
      : 0;
    const affiliateSettings = getProductAffiliateSettings(product);
    const commissionPerSale = calculateCommissionForAmount(product.price, affiliateSettings);

    // Format response
    const responseData = {
      ...product.toObject(),
      store: store || null,
      affiliate: affiliateSettings,
      commissionPerSale,
      amountReceivable: roundMoney(product.price - commissionPerSale),
      activePromotion: activePromotion ? {
        _id: activePromotion._id,
        trackingCode: activePromotion.uniqueCode,
        uniqueId: activePromotion.uniqueId,
        promoter: activePromotion.promoter,
        commissionRate: activePromotion.commissionRate,
        commissionType: activePromotion.commissionType,
        fixedCommission: activePromotion.fixedCommission,
        clickCount: activePromotion.clickCount,
        viewCount: activePromotion.viewCount,
        conversionCount: activePromotion.conversionCount,
        earnings: activePromotion.earnings,
      } : null,
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

async function recordStoreProductView(storeId, { promoterTraffic = false } = {}) {
  if (!storeId) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await Promise.all([
    StoreModel.findByIdAndUpdate(storeId, {
      $inc: {
        'analytics.totalViews': 1,
        'analytics.promoterTraffic': promoterTraffic ? 1 : 0
      }
    }),
    upsertDailyStoreView(storeId, today, promoterTraffic)
  ]);
}

async function upsertDailyStoreView(storeId, date, promoterTraffic) {
  const updated = await StoreAnalyticsModel.findOneAndUpdate(
    { store: storeId, 'dailyViews.date': date },
    {
      $inc: {
        'dailyViews.$.views': 1,
        'dailyViews.$.uniqueVisitors': 1,
        'dailyViews.$.promoterTraffic': promoterTraffic ? 1 : 0
      },
      $set: { lastCalculated: new Date() }
    },
    { new: true }
  );

  if (updated) return updated;

  return StoreAnalyticsModel.findOneAndUpdate(
    { store: storeId },
    {
      $setOnInsert: { store: storeId },
      $push: {
        dailyViews: {
          date,
          views: 1,
          uniqueVisitors: 1,
          promoterTraffic: promoterTraffic ? 1 : 0
        }
      },
      $set: { lastCalculated: new Date() }
    },
    { upsert: true, new: true }
  );
}

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
