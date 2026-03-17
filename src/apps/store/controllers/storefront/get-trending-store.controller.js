import { StoreModel } from '../../models/store.model.js';
import { ProductModel, PromotionTrackingModel } from '../../models/product.model.js';
import { StoreAnalyticsModel } from '../../models/store-analytics.model.js';
import mongoose from 'mongoose';

/**
 * @desc    Get trending stores
 * @route   GET /api/stores/trending
 * @access  Public
 */
export const getTrendingStores = async (req, res) => {
  try {
    const { limit = 8 } = req.query;

    const stores = await StoreModel.find({
      isVerified: true,
      isDeleted: { $ne: true },
      'analytics.totalViews': { $gt: 0 }
    })
    .sort({ 'analytics.totalViews': -1, 'analytics.conversionRate': -1 })
    .limit(Number(limit))
    .select('name description logo category isVerified verificationTier storeLink analytics')
    .populate('owner', 'name profilePicture');

    res.status(200).json({
      success: true,
      data: stores
    });
  } catch (error) {
    console.error('Get trending stores error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};