// promotion.controller.js
import { CampaignModel } from "../../campaign/models/campaign.model.js";
import { PromotionModel } from "../../campaign/models/promotion.model.js";
import { UserModel } from "../../user/models/user.model.js";;
import mongoose from "mongoose";
import path from "path";
import fs from "fs";
import { isPromotionExpired, calculateTimeRemaining, calculateViewsNeeded, calculateProgressPercentage } from './../services/utils.js'

// Get promotion by ID with populated data
export const getPromotionById = async (req, res) => {
  try {
    const { id } = req.params;
    const {userId} = req.params; // Assuming you have user authentication

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
        select: 'title mediaUrl caption link category mediaType budget payoutPerPromotion currency maxPromoters minViewsPerPromotion campaignType priority difficulty tags estimatedViews duration targetAudience requirements activityLog createdAt',
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
    const promotionData = promotion.toObject();
    
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

// Get all promotions for a user with filtering and pagination
export const getUserPromotions = async (req, res) => {
  try {
    //const userId = req.user._id;
    const { userId } = req.params;
    const { status, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

     // Validate that the userId is provided
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required.",
      });
    }

    // Find the user and check their role
    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Promoter not found.",
      });
    }

    if (user.role !== "promoter") {
      return res.status(400).json({
        success: false,
        message:
          "Your current user role is not promoter. Please switch roles to continue.",
      });
    }

    // Build query
    const query = { promoter: userId };
    if (status && status !== 'all') {
      query.status = status;
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with pagination
    const promotions = await PromotionModel.find(query)
      .populate({
        path: 'campaign',
        select: "",
        //select: 'title category mediaType payoutPerPromotion minViewsPerPromotion'
      })
      .populate({
        path: "promoter",
        // Select all fields from the User model, but explicitly exclude the password
        select: "-password",
      })
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    if (!promotions || promotions.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No promotions found for this user.",
      });
    }

    // Get total count for pagination
    const total = await PromotionModel.countDocuments(query);

    // Calculate additional data for each promotion
    const enhancedPromotions = promotions.map(promotion => {
      const promotionData = promotion.toObject();
      promotionData.isExpired = isPromotionExpired(promotion);
      promotionData.timeRemaining = calculateTimeRemaining(promotion);
      promotionData.progressPercentage = calculateProgressPercentage(promotion);
      return promotionData;
    });

    res.status(200).json({
      success: true,
      data: enhancedPromotions,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });

  } catch (error) {
    console.error('Error fetching user promotions:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


