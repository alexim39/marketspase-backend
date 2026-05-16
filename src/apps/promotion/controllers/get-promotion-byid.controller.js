// promotion.controller.js
import { PromotionModel } from "../models/index.js";
import mongoose from "mongoose";
import { isPromotionExpired, calculateTimeRemaining, calculateViewsNeeded, calculateProgressPercentage } from '../services/utils.js'
import { normalizePromotionTrackingFields } from "../utils/promotion-url.js";

// Get promotion by ID with populated data
export const GetPromotionById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid promotion ID format'
      });
    }

    // Find promotion and populate all necessary fields
    const promotion = await PromotionModel.findById(id)
      .populate({
        path: 'campaign',
        select: 'title mediaUrl caption link category mediaType budget payoutPerPromotion costPerClick currency maxPromoters minViewsPerPromotion campaignType priority difficulty tags thumbnailUrl estimatedViews duration targetAudience requirements activityLog createdAt endDate status spentBudget reservedBudget remainingBudget',
        populate: {
          path: 'owner',
          select: 'username displayName avatar'
        }
      })
      .populate({
        path: 'promoter',
        select: 'username displayName email avatar rating ratingCount'
      })
      .populate({
        path: 'validatedBy paidBy',
        select: 'username displayName'
      })
      .populate({
        path: 'activityLog.performedBy',
        select: 'username displayName'
      });

    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: 'Promotion not found'
      });
    }

    // Check if the authenticated user owns this promotion
    if (promotion.promoter._id.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own promotions'
      });
    }

    // Calculate additional data for the frontend
    const promotionData = normalizePromotionTrackingFields(promotion.toObject());
    
    // Add calculated fields
    promotionData.isExpired = isPromotionExpired(promotion);
    promotionData.timeRemaining = calculateTimeRemaining(promotion);
    promotionData.progressPercentage = calculateProgressPercentage(promotion);
    promotionData.viewsNeeded = calculateViewsNeeded(promotion);

    res.status(200).json({
      success: true,
      promotion: promotionData
    });

  } catch (error) {
    console.error('Error fetching promotion:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};



