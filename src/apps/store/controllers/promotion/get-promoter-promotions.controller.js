import mongoose from 'mongoose';
import { PromotionTrackingModel } from '../../models/promotion/index.js';
import { buildAffiliateUrl } from '../../services/storefront-affiliate.service.js';

export const getPromoterPromotions = async (req, res) => {
  try {
    const promoterId = req.userId;
    if (req.user?.role !== 'promoter' && req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only promoters can view promotion links'
      });
    }

    if (!promoterId || !mongoose.Types.ObjectId.isValid(promoterId)) {
      return res.status(400).json({
        success: false,
        message: 'A valid promoterId is required'
      });
    }

    const promotions = await PromotionTrackingModel.find({
      promoter: promoterId,
      isActive: true
    })
      .populate('product', 'name price currency images category isActive isPublished')
      .populate('store', 'name logo storeLink')
      .sort({ lastActivityAt: -1, createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: promotions.map((promotion) => ({
        ...promotion,
        affiliateUrl: buildAffiliateUrl(req, promotion.uniqueCode)
      }))
    });
  } catch (error) {
    console.error('Error fetching promotions:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch promotions'
    });
  }
};
