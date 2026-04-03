// controllers/product/product-tracking.controller.js
import { PromotionTrackingModel, ProductModel } from '../../models/promotion/index.js';

/**
 * Track product view from promotion link
 */
export const trackProductView = async (req, res) => {
  try {
    const { productId } = req.params;
    const { trackingCode, deviceType = 'desktop', source } = req.query;

    console.log('Tracking view:', { productId, trackingCode, deviceType, source });

    if (!trackingCode) {
      return res.status(400).json({
        success: false,
        message: 'Tracking code is required'
      });
    }

    // Find promotion by tracking code
    const promotion = await PromotionTrackingModel.findOne({ uniqueCode: trackingCode });
    
    if (!promotion) {
      console.log('Promotion not found for code:', trackingCode);
      return res.status(404).json({
        success: false,
        message: 'Invalid tracking code'
      });
    }

    console.log('Found promotion:', promotion._id);

    // Increment view count
    promotion.viewCount += 1;
    promotion.lastActivityAt = new Date();
    
    // Track device type
    if (deviceType && ['mobile', 'desktop', 'tablet'].includes(deviceType)) {
      promotion.deviceTypes[deviceType] += 1;
    }

    // Track source if provided
    if (source) {
      const sourceIndex = promotion.referralSources.findIndex(s => s.source === source);
      if (sourceIndex > -1) {
        promotion.referralSources[sourceIndex].count += 1;
      } else {
        promotion.referralSources.push({ source, count: 1 });
      }
    }

    // Calculate CTR
    if (promotion.viewCount > 0) {
      promotion.clickThroughRate = (promotion.clickCount / promotion.viewCount) * 100;
    }

    await promotion.save();

    console.log('View tracked successfully. New view count:', promotion.viewCount);

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
    const { deviceType = 'desktop', source, productId } = req.query;

    const promotion = await PromotionTrackingModel.findOne({ uniqueCode });

    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: 'Invalid tracking code'
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
    if (source) {
      const sourceIndex = promotion.referralSources.findIndex(s => s.source === source);
      if (sourceIndex > -1) {
        promotion.referralSources[sourceIndex].count += 1;
      } else {
        promotion.referralSources.push({ source, count: 1 });
      }
    }

    // Calculate rates
    if (promotion.viewCount > 0) {
      promotion.clickThroughRate = (promotion.clickCount / promotion.viewCount) * 100;
    }

    await promotion.save();

    // Return tracking info or redirect
    if (req.query.redirect === 'false') {
      return res.status(200).json({
        success: true,
        message: 'Click tracked successfully',
        data: {
          promotionId: promotion._id,
          productId: promotion.product,
          clickCount: promotion.clickCount
        }
      });
    }

    // Get product details for redirect
    const product = await ProductModel.findById(promotion.product);
    
    // Redirect to product page with tracking params
    res.redirect(`/product/${product._id}?track=${uniqueCode}&ref=${promotion.uniqueId}`);
    
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