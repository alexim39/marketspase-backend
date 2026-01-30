import mongoose from 'mongoose';
import { ProductModel } from '../../models/product.model.js';
import { PromotionTrackingModel } from '../../models/product.model.js';
import { StoreModel } from '../../models/store.model.js';

/**
 * @desc    Track product view (for analytics)
 * @route   POST /api/promoter/products/:id/view
 * @access  Private/Promoter
 */
export const trackProductView = async (req, res) => {
  try {
    const { id } = req.params;
    const promoterId = req.user?._id;
    const { deviceType = 'desktop', referralSource } = req.body;

    if (!promoterId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Find or create promotion tracking
    let promotionTracking = await PromotionTrackingModel.findOne({
      product: id,
      promoter: promoterId
    });

    if (!promotionTracking) {
      // Create new tracking record
      promotionTracking = new PromotionTrackingModel({
        product: id,
        promoter: promoterId,
        store: req.body.storeId, // Should be provided
        commissionRate: req.body.commissionRate || 10, // Default commission
        commissionType: 'percentage',
        isActive: true,
        isApproved: true
      });
    }

    // Increment view count
    promotionTracking.viewCount += 1;

    // Track device type
    if (deviceType && ['mobile', 'desktop', 'tablet'].includes(deviceType)) {
      promotionTracking.deviceTypes[deviceType] += 1;
    }

    // Track referral source
    if (referralSource) {
      const sourceIndex = promotionTracking.referralSources.findIndex(
        s => s.source === referralSource
      );
      
      if (sourceIndex >= 0) {
        promotionTracking.referralSources[sourceIndex].count += 1;
      } else {
        promotionTracking.referralSources.push({
          source: referralSource,
          count: 1
        });
      }
    }

    promotionTracking.lastActivityAt = new Date();
    await promotionTracking.save();

    res.status(200).json({
      success: true,
      message: 'View tracked successfully',
      trackingCode: promotionTracking.uniqueCode
    });

  } catch (error) {
    console.error('Error tracking product view:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while tracking view',
      error: error.message
    });
  }
};