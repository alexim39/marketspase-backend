// controllers/promotion/create-promotion.controller.js
import { ProductModel, PromotionTrackingModel } from '../../models/promotion/index.js';
import { StoreModel } from '../../models/store/index.js';
import { UserModel } from '../../../user/models/user/index.js';
import {
  buildAffiliateUrl,
  buildProductLandingUrl,
  getProductAffiliateSettings
} from '../../services/storefront-affiliate.service.js';

export const createPromotion = async (req, res) => {
  try {
    const { productId, storeId } = req.body;
    const promoterId = req.userId;

    //console.log('Request body:', req.body);

    // Validate required fields
    if (!productId || !promoterId || !storeId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: productId, promoterId, or storeId'
      });
    }

    const [product, store, promoter] = await Promise.all([
      ProductModel.findOne({
        _id: productId,
        store: storeId,
        isActive: true,
        isDeleted: false,
        isPublished: true,
      }),
      StoreModel.findById(storeId).select('_id owner name isActive'),
      UserModel.findById(promoterId).select('_id role displayName username isActive'),
    ]);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or not available for affiliate promotion'
      });
    }

    if (!store || store.isActive === false) {
      return res.status(404).json({
        success: false,
        message: 'Store not found or inactive'
      });
    }

    if (!promoter || promoter.isActive === false) {
      return res.status(404).json({
        success: false,
        message: 'Promoter not found or inactive'
      });
    }

    if (promoter.role !== 'promoter' && req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only promoters can generate affiliate links'
      });
    }

    if (store.owner?.toString() === promoterId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Store owners cannot generate affiliate links for their own products'
      });
    }

    const affiliateSettings = getProductAffiliateSettings(product);
    if (!affiliateSettings.enabled) {
      return res.status(400).json({
        success: false,
        message: 'Affiliate promotion is disabled for this product'
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
        data: formatPromotionResponse(req, existingPromotion),
        message: 'Promotion already exists for this product'
      });
    }

    // Create new promotion with explicit codes
    const promotionData = {
      product: productId,
      promoter: promoterId,
      store: storeId,
      commissionRate: affiliateSettings.commissionRate,
      commissionType: affiliateSettings.commissionType,
      fixedCommission: affiliateSettings.fixedCommission,
      isActive: true,
      isApproved: affiliateSettings.autoApprovePromoters,
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
      data: formatPromotionResponse(req, promotion),
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

function formatPromotionResponse(req, promotion) {
  const plain = typeof promotion.toObject === 'function' ? promotion.toObject() : promotion;
  const affiliateUrl = buildAffiliateUrl(req, plain.uniqueCode);
  const landingUrl = buildProductLandingUrl({
    productId: plain.product,
    uniqueCode: plain.uniqueCode,
    uniqueId: plain.uniqueId,
    promoterId: plain.promoter,
    clicked: false,
  });

  return {
    ...plain,
    affiliateUrl,
    promotionUrl: affiliateUrl,
    shareUrl: affiliateUrl,
    landingUrl,
    trackingCode: plain.uniqueCode,
  };
}
