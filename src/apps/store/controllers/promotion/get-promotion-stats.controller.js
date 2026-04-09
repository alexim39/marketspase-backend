/* // controllers/promotion.controller.js
import { PromotionTrackingModel } from '../../models/promotion/index.js';

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

 */