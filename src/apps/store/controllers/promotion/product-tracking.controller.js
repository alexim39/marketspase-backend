// controllers/product/product-tracking.controller.js
import { PromotionTrackingModel } from '../../models/promotion/index.js';
import { AffiliateClickModel } from '../../models/affiliate-click/index.js';
import { AffiliateViewModel } from '../../models/affiliate-view/index.js';
import {
  buildProductLandingUrl,
  detectDeviceType,
  getClientIp,
  hashIp,
  upsertReferralSource
} from '../../services/storefront-affiliate.service.js';

/**
 * Track product view from promotion link
 */
export const trackProductView = async (req, res) => {
  try {
    const { productId } = req.params;
    const payload = { ...req.query, ...req.body };
    const { trackingCode, uniqueId, source } = payload;
    const deviceType = payload.deviceType || detectDeviceType(req.headers['user-agent'] || '');

    if (!trackingCode && !uniqueId) {
      return res.status(400).json({
        success: false,
        message: 'Tracking code or unique ID is required'
      });
    }

    // Find promotion by tracking code
    const promotion = await PromotionTrackingModel.findOne({
      product: productId,
      isActive: true,
      $or: [
        ...(trackingCode ? [{ uniqueCode: trackingCode }] : []),
        ...(uniqueId ? [{ uniqueId }] : [])
      ]
    });
    
    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: 'Invalid tracking code'
      });
    }

    // Increment view count
    promotion.viewCount += 1;
    promotion.lastActivityAt = new Date();
    
    // Track device type
    if (deviceType && ['mobile', 'desktop', 'tablet'].includes(deviceType)) {
      promotion.deviceTypes[deviceType] += 1;
    }

    // Track source if provided
    if (source) {
      promotion.referralSources = upsertReferralSource(promotion.referralSources, source);
    }

    // Calculate CTR
    if (promotion.viewCount > 0) {
      promotion.clickThroughRate = (promotion.clickCount / promotion.viewCount) * 100;
    }

    await promotion.save();

    // Best-effort: persist an event-level view record for time-series analytics.
    // Do not fail the request if logging fails (we still count the view in PromotionTracking).
    try {
      await AffiliateViewModel.create({
        promotionTracking: promotion._id,
        product: promotion.product,
        store: promotion.store,
        promoter: promotion.promoter,
        viewedAt: new Date(),
        deviceType,
        source: source || req.headers.referer || 'direct',
        referrer: req.headers.referer || '',
        ipHash: hashIp(getClientIp(req)),
        userAgent: req.headers['user-agent'] || '',
      });
    } catch (logError) {
      console.error('Failed to log affiliate view event:', logError);
    }

    res.status(200).json({
      success: true,
      message: 'View tracked successfully',
      data: {
        promotionId: promotion._id,
        viewCount: promotion.viewCount
      }
    });
  } catch (error) {
    console.error('Error tracking view:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track view'
    });
  }
};

/**
 * Track click on promotion link (when user clicks the link)
 */
export const trackClick = async (req, res) => {
  try {
    const { uniqueCode } = req.params;
    const payload = { ...req.query, ...req.body };
    const deviceType = payload.deviceType || detectDeviceType(req.headers['user-agent'] || '');
    const source = payload.source || req.headers.referer || 'direct';

    const promotion = await PromotionTrackingModel.findOne({
      uniqueCode,
      isActive: true,
      isApproved: true,
    }).populate('product', '_id name isActive isDeleted isPublished').populate('store', '_id isActive');

    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: 'Invalid tracking code'
      });
    }

    const product = promotion.product;
    if (!product || product.isActive === false || product.isDeleted || product.isPublished === false) {
      return res.status(410).json({
        success: false,
        message: 'Product is not available'
      });
    }

    // Increment click count
    promotion.clickCount += 1;
    promotion.lastActivityAt = new Date();
    
    // Track device type
    if (deviceType && ['mobile', 'desktop', 'tablet'].includes(deviceType)) {
      promotion.deviceTypes[deviceType] += 1;
    }

    // Track source if provided
    promotion.referralSources = upsertReferralSource(promotion.referralSources, source);

    // Calculate rates
    if (promotion.viewCount > 0) {
      promotion.clickThroughRate = (promotion.clickCount / promotion.viewCount) * 100;
    }

    await promotion.save();
    await Promise.all([
      AffiliateClickModel.create({
        promotionTracking: promotion._id,
        product: product._id,
        store: promotion.store?._id || promotion.store,
        promoter: promotion.promoter,
        cost: 0,
        deviceType,
        source,
        referrer: req.headers.referer || '',
        ipHash: hashIp(getClientIp(req)),
        userAgent: req.headers['user-agent'] || '',
      }),
    ]);

    // Return tracking info or redirect
    if (req.query.redirect === 'false') {
      return res.status(200).json({
        success: true,
        message: 'Click tracked successfully',
        data: {
          promotionId: promotion._id,
          productId: product._id,
          clickCount: promotion.clickCount
        }
      });
    }

    const redirectUrl = buildProductLandingUrl({
      productId: product._id,
      uniqueCode,
      uniqueId: promotion.uniqueId,
      promoterId: promotion.promoter,
      clicked: true,
    });

    res.redirect(302, redirectUrl);
    
  } catch (error) {
    console.error('Error tracking click:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track click'
    });
  }
};

/**
 * Get promotion performance data for a product
 */
/* export const getPromotionPerformance = async (req, res) => {
  try {
    const { productId } = req.params;
    const { promoterId } = req.query;

    const query = { product: productId };
    if (promoterId) {
      query.promoter = promoterId;
    }

    const promotion = await PromotionTrackingModel.findOne(query)
      .populate('product', 'name price images')
      .populate('promoter', 'name email');

    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: 'Promotion not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        trackingId: promotion._id,
        productId: promotion.product._id,
        productName: promotion.product.name,
        productPrice: promotion.product.price,
        productImage: promotion.product.images?.[0]?.url,
        views: promotion.viewCount,
        clicks: promotion.clickCount,
        conversions: promotion.conversionCount,
        earnings: promotion.earnings,
        clickThroughRate: promotion.clickThroughRate,
        conversionRate: promotion.conversionRate,
        uniqueCode: promotion.uniqueCode,
        uniqueId: promotion.uniqueId,
        isActive: promotion.isActive,
        commissionRate: promotion.commissionRate,
        deviceTypes: promotion.deviceTypes,
        referralSources: promotion.referralSources,
        createdAt: promotion.createdAt,
        lastActivityAt: promotion.lastActivityAt
      }
    });
  } catch (error) {
    console.error('Error fetching promotion performance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch promotion performance'
    });
  }
}; */
