// controllers/promotion/create-promotion.controller.js
import { PromotionTrackingModel } from '../../models/promotion/index.js';

export const createPromotion = async (req, res) => {
  try {
    const { productId, promoterId, storeId, commissionRate, commissionType, fixedCommission } = req.body;

    //console.log('Request body:', req.body);

    // Validate required fields
    if (!productId || !promoterId || !storeId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: productId, promoterId, or storeId'
      });
    }

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
        message: 'Promotion already exists for this product'
      });
    }

    // Create new promotion with explicit codes
    const promotionData = {
      product: productId,
      promoter: promoterId,
      store: storeId,
      commissionRate: commissionRate || 0,
      commissionType: commissionType || 'percentage',
      fixedCommission: fixedCommission || 0,
      isActive: true,
      isApproved: true,
      startDate: new Date(),
      // Initialize default values
      viewCount: 0,
      clickCount: 0,
      conversionCount: 0,
      earnings: 0,
      clickThroughRate: 0,
      conversionRate: 0,
      averageOrderValue: 0,
      deviceTypes: {
        mobile: 0,
        desktop: 0,
        tablet: 0
      }
    };

    const promotion = new PromotionTrackingModel(promotionData);

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
      message: 'Failed to create promotion',
      error: error.message,
      details: error.errors // This will show validation errors
    });
  }
};