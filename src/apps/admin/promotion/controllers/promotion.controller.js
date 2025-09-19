// promotion.controller.js
import { CampaignModel } from "../../campaign/models/campaign.model.js";
import { PromotionModel } from "../../campaign/models/promotion.model.js";
import { UserModel } from "../../user/models/user.model.js";;
import mongoose from "mongoose";
import { validateProofSubmission } from "../../promotion/services/validator.js";
import path from "path";
import fs from "fs";


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

// Download promotion media
/* export const downloadPromotion = async (req, res) => {
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
 */



/**
 * @description Allows a promoter to "download" a campaign post. This action
 * marks the promotion as 'isDownloaded' and registers the promoter to the campaign.
 * It also checks if the campaign has available slots and updates the campaign's
 * `currentPromoters` count within a secure transaction.
 * @param {object} req - The request object containing campaignId and promoterId.
 * @param {object} res - The response object from Express.js.
 * @returns {Promise<void>}
 */
export const downloadPromotion = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { campaignId, promoterId } = req.body;

    // Validate required fields
    if (!campaignId || !promoterId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Missing required fields: campaignId and promoterId.",
        success: false,
      });
    }

    // Find the campaign and user (promoter) with population
    const campaign = await CampaignModel.findById(campaignId)
      .populate('owner')
      .session(session);
    const promoter = await UserModel.findById(promoterId).session(session);

    if (!campaign || !promoter) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        message: "Campaign or Promoter not found.",
        success: false,
      });
    }

    // Check if the user is a promoter
    if (promoter.role !== 'promoter') {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        message: 'User is not authorized to download this promotion.',
        success: false,
      });
    }

    // Check if campaign is active
    if (campaign.status !== 'active') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: `Campaign is not active. Current status: ${campaign.status}`,
        success: false,
      });
    }

    // Check if campaign can accept more promoters
    if (!campaign.canAssignPromoter()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: 'Campaign is full or budget exhausted.',
        success: false,
      });
    }

    // Check if a promotion already exists for this campaign and promoter
    const existingPromotion = await PromotionModel.findOne({
      campaign: campaignId,
      promoter: promoterId,
    }).session(session);

    // If no promotion exists, create a new one.
    let promotion;
    if (!existingPromotion) {
      promotion = new PromotionModel({
        campaign: campaignId,
        promoter: promoterId,
        payoutAmount: campaign.payoutPerPromotion,
        isDownloaded: true,
        notes: "Campaign post downloaded by promoter.",
        activityLog: [{
          action: "Campaign Downloaded",
          details: "Promoter downloaded campaign materials",
          timestamp: new Date()
        }]
      });
      await promotion.save({ session });
    } else {
      // If a promotion exists but isn't marked as downloaded, update it
      existingPromotion.isDownloaded = true;
      existingPromotion.notes = "Campaign post re-downloaded by promoter.";
      existingPromotion.activityLog.push({
        action: "Campaign Re-downloaded",
        details: "Promoter re-downloaded campaign materials",
        timestamp: new Date()
      });
      promotion = existingPromotion;
      await promotion.save({ session });
    }

    // Use the `assignPromoter` helper method from the Campaign model
    campaign.assignPromoter();
    
    // Reserve funds from marketer's wallet to promoter's reserved wallet
    const marketer = campaign.owner;
    const payoutAmount = campaign.payoutPerPromotion;
    
    // Check if marketer has sufficient reserved funds
    if (marketer.wallets.marketer.reserved < payoutAmount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(402).json({
        message: "Insufficient reserved funds in marketer's wallet.",
        success: false,
      });
    }
    
    // Transfer funds from marketer's reserved to promoter's reserved
    marketer.wallets.marketer.reserved -= payoutAmount;
    promoter.wallets.promoter.reserved += payoutAmount;
    
    // Add transaction records
    marketer.wallets.marketer.transactions.push({
      amount: payoutAmount,
      type: "debit",
      category: "campaign",
      description: `Funds reserved for promoter ${promoter.displayName} for campaign: "${campaign.title}"`,
      relatedCampaign: campaignId,
      relatedPromotion: promotion._id,
      status: "successful",
    });
    
    promoter.wallets.promoter.transactions.push({
      amount: payoutAmount,
      type: "credit",
      category: "promotion",
      description: `Funds reserved from campaign: "${campaign.title}"`,
      relatedCampaign: campaignId,
      relatedPromotion: promotion._id,
      status: "reserved",
    });
    
    // Update campaign activity log
    campaign.activityLog.push({
      action: "Promoter Registered",
      details: `Promoter ${promoter.displayName} downloaded campaign. Total promoters: ${campaign.currentPromoters}`,
      timestamp: new Date()
    });

    // Save all documents
    await campaign.save({ session });
    await marketer.save({ session });
    await promoter.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      message: "Campaign post downloaded successfully. You can now share it on your status.",
      success: true,
      campaign: {
        title: campaign.title,
        caption: campaign.caption,
        link: campaign.link,
        mediaUrl: `${req.protocol}://${req.get("host")}${campaign.mediaUrl}`,
        mediaType: campaign.mediaType,
      },
      promotionId: promotion._id,
      upi: promotion.upi,
      reservedAmount: payoutAmount
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error downloading promotion:", error.message);
    res.status(500).json({
      message: "Error occurred while processing the download request.",
      success: false,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};









// Submit proof for a promotion
/* export const submitProof = async (req, res) => {
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
}; */



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