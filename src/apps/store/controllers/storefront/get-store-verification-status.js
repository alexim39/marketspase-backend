import { StoreModel } from '../../models/store.model.js';
import { ProductModel, PromotionTrackingModel } from '../../models/product.model.js';
import { StoreAnalyticsModel } from '../../models/store-analytics.model.js';
import mongoose from 'mongoose';

/**
 * @desc    Get store verification status
 * @route   GET /api/stores/:storeId/verification-status
 * @access  Public
 */
export const getStoreVerificationStatus = async (req, res) => {
  try {
    const { storeId } = req.params;

    const store = await StoreModel.findById(storeId).select('isVerified verificationTier verificationDate');

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    res.status(200).json({
      verified: store.isVerified,
      tier: store.verificationTier,
      verificationDate: store.verificationDate
    });
  } catch (error) {
    console.error('Get verification status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};