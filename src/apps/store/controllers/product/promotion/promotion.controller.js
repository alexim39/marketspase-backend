// controllers/promotion.controller.js
import { PromotionTrackingModel, ProductModel } from '../../../models/promotion/index.js';

export const createPromotion = async (req, res) => {
  try {
    const { productId, promoterId, storeId, commissionRate, commissionType, fixedCommission } = req.body;

    // Check if promotion already exists
    let existingPromotion = await PromotionTrackingModel.findOne({
      product: productId,
      promoter: promoterId,
      isActive: true
    });

    if (existingPromotion) {
      return res.status(200).json({
        success: true,
        data: existingPromotion,
        message: 'Promotion already exists'
      });
    }

    // Create new promotion
    const promotion = new PromotionTrackingModel({
      product: productId,
      promoter: promoterId,
      store: storeId,
      commissionRate,
      commissionType,
      fixedCommission: fixedCommission || 0,
      isActive: true,
      isApproved: true, // Set based on your business logic
      startDate: new Date()
    });

    await promotion.save();

    res.status(201).json({
      success: true,
      data: promotion,
      message: 'Promotion created successfully'
    });
  } catch (error) {
    console.error('Error creating promotion:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create promotion'
    });
  }
};

export const getPromoterPromotions = async (req, res) => {
  try {
    const { promoterId } = req.query;

    const promotions = await PromotionTrackingModel.find({
      promoter: promoterId,
      isActive: true
    })
    .populate('product', 'name price images category')
    .populate('store', 'name logo')
    .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: promotions
    });
  } catch (error) {
    console.error('Error fetching promotions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch promotions'
    });
  }
};

export const getPromotionStats = async (req, res) => {
  try {
    const { productId, promoterId } = req.query;

    const promotion = await PromotionTrackingModel.findOne({
      product: productId,
      promoter: promoterId
    }).populate('product', 'name price');

    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: 'Promotion not found'
      });
    }

    const stats = {
      trackingId: promotion._id,
      productId: promotion.product._id,
      productName: promotion.product.name,
      views: promotion.viewCount,
      clicks: promotion.clickCount,
      conversions: promotion.conversionCount,
      earnings: promotion.earnings,
      clickThroughRate: promotion.clickThroughRate,
      conversionRate: promotion.conversionRate,
      uniqueCode: promotion.uniqueCode,
      uniqueId: promotion.uniqueId,
      createdAt: promotion.createdAt,
      lastActivityAt: promotion.lastActivityAt,
      deviceTypes: promotion.deviceTypes
    };

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching promotion stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch promotion stats'
    });
  }
};

export const getPromotionDashboard = async (req, res) => {
  try {
    const { promoterId } = req.query;

    const promotions = await PromotionTrackingModel.find({
      promoter: promoterId
    })
    .populate('product', 'name price')
    .sort({ createdAt: -1 });

    const totalEarnings = promotions.reduce((sum, p) => sum + (p.earnings || 0), 0);
    const totalClicks = promotions.reduce((sum, p) => sum + (p.clickCount || 0), 0);
    const totalConversions = promotions.reduce((sum, p) => sum + (p.conversionCount || 0), 0);
    const activePromotions = promotions.filter(p => p.isActive).length;

    res.status(200).json({
      success: true,
      data: {
        totalEarnings,
        totalClicks,
        totalConversions,
        activePromotions,
        promotions: promotions.map(p => ({
          trackingId: p._id,
          productId: p.product._id,
          productName: p.product.name,
          productPrice: p.product.price,
          views: p.viewCount,
          clicks: p.clickCount,
          conversions: p.conversionCount,
          earnings: p.earnings,
          clickThroughRate: p.clickThroughRate,
          conversionRate: p.conversionRate,
          uniqueCode: p.uniqueCode,
          createdAt: p.createdAt,
          lastActivityAt: p.lastActivityAt,
          isActive: p.isActive
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data'
    });
  }
};

// Tracking endpoint for clicks
export const trackClick = async (req, res) => {
  try {
    const { uniqueCode } = req.params;
    const { deviceType = 'desktop', source } = req.query;

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

    // Calculate CTR
    if (promotion.viewCount > 0) {
      promotion.clickThroughRate = (promotion.clickCount / promotion.viewCount) * 100;
    }

    await promotion.save();

    // Redirect to product page with tracking
    const product = await ProductModel.findById(promotion.product);
    res.redirect(`/products/${product.slug}?ref=${promotion.uniqueId}&track=${uniqueCode}`);
    
  } catch (error) {
    console.error('Error tracking click:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track click'
    });
  }
};