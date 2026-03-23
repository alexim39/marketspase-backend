// controllers/promotion.controller.js
import { PromotionTrackingModel } from '../../models/promotion/index.js';


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