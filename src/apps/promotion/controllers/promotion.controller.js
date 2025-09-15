// promotion.controller.js
import { CampaignModel } from "../../campaign/models/campaign.model.js";
import { PromotionModel } from "../../campaign/models/promotion.model.js";
import { UserModel } from "../../user/models/user.model.js";;
import mongoose from "mongoose";

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
    const userId = req.user._id;
    const { status, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

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
        select: 'title category mediaType payoutPerPromotion minViewsPerPromotion'
      })
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

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
      promotions: enhancedPromotions,
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

// Submit proof for a promotion
export const submitProof = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const { proofMedia, proofViews } = req.body;

    // Validate input
    if (!proofMedia || !proofMedia.length || !proofViews) {
      return res.status(400).json({
        success: false,
        message: 'Proof media and views are required'
      });
    }

    if (proofViews < 25) {
      return res.status(400).json({
        success: false,
        message: 'Minimum 25 views required for submission'
      });
    }

    // Find promotion
    const promotion = await PromotionModel.findById(id)
      .populate('campaign');

    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: 'Promotion not found'
      });
    }

    // Check ownership
    if (promotion.promoter.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if already submitted
    if (promotion.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Proof already submitted for this promotion'
      });
    }

    // Check if promotion is expired
    if (isPromotionExpired(promotion)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot submit proof for expired promotion'
      });
    }

    // Check if it's too early to submit (30 minutes before expiration)
    if (!isNearingExpiration(promotion)) {
      return res.status(400).json({
        success: false,
        message: 'Proof submission is only allowed within 30 minutes of expiration'
      });
    }

    // Update promotion
    promotion.proofMedia = proofMedia;
    promotion.proofViews = proofViews;
    promotion.status = 'submitted';
    promotion.submittedAt = new Date();

    // Add to activity log
    promotion.activityLog.push({
      action: 'Proof Submitted',
      details: `Submitted proof with ${proofViews} views`,
      performedBy: userId
    });

    await promotion.save();

    // Update campaign stats
    await CampaignModel.findByIdAndUpdate(
      promotion.campaign._id,
      {
        $inc: { totalPromotions: 1 }
      }
    );

    res.status(200).json({
      success: true,
      message: 'Proof submitted successfully',
      promotion
    });

  } catch (error) {
    console.error('Error submitting proof:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Download promotion media
export const downloadPromotion = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const promotion = await PromotionModel.findById(id)
      .populate('campaign');

    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: 'Promotion not found'
      });
    }

    // Check ownership
    if (promotion.promoter.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if already downloaded
    if (promotion.isDownloaded) {
      return res.status(400).json({
        success: false,
        message: 'Promotion already downloaded'
      });
    }

    // Mark as downloaded
    promotion.isDownloaded = true;
    promotion.activityLog.push({
      action: 'Media Downloaded',
      details: 'Promoter downloaded campaign materials',
      performedBy: userId
    });

    await promotion.save();

    res.status(200).json({
      success: true,
      message: 'Promotion downloaded successfully',
      campaign: promotion.campaign
    });

  } catch (error) {
    console.error('Error downloading promotion:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Helper functions
const isPromotionExpired = (promotion) => {
  const createdAt = new Date(promotion.createdAt);
  const expirationTime = createdAt.getTime() + (24 * 60 * 60 * 1000);
  return Date.now() > expirationTime;
};

const calculateTimeRemaining = (promotion) => {
  const createdAt = new Date(promotion.createdAt);
  const expirationTime = createdAt.getTime() + (24 * 60 * 60 * 1000);
  const timeRemaining = expirationTime - Date.now();
  
  if (timeRemaining <= 0) return 'Expired';
  
  const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
  const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const calculateProgressPercentage = (promotion) => {
  const minViews = promotion.campaign?.minViewsPerPromotion || 25;
  const currentViews = promotion.proofViews || 0;
  return Math.min((currentViews / minViews) * 100, 100);
};

const calculateViewsNeeded = (promotion) => {
  const minViews = promotion.campaign?.minViewsPerPromotion || 25;
  const currentViews = promotion.proofViews || 0;
  return Math.max(minViews - currentViews, 0);
};

const isNearingExpiration = (promotion) => {
  const createdAt = new Date(promotion.createdAt);
  const expirationTime = createdAt.getTime() + (24 * 60 * 60 * 1000);
  const thirtyMinutesInMs = 30 * 60 * 1000;
  const timeRemaining = expirationTime - Date.now();
  
  return timeRemaining > 0 && timeRemaining <= thirtyMinutesInMs;
};