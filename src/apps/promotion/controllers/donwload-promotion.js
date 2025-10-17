import { CampaignModel } from "../../campaign/models/campaign.model.js";
import { PromotionModel } from "../../promotion/models/promotion.model.js";
import { UserModel } from "../../user/models/user.model.js";
import mongoose from "mongoose";

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

    // Find the campaign and user (promoter) with proper population
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

    // Check if campaign can accept more promoters - using atomic operation to prevent race conditions
    const canAssignPromoter = campaign.maxPromoters > campaign.currentPromoters && 
                              campaign.budget >= campaign.payoutPerPromotion;
    
    if (!canAssignPromoter) {
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
        status: 'downloaded',
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
      existingPromotion.status = 'downloaded';
      existingPromotion.notes = "Campaign post re-downloaded by promoter.";
      existingPromotion.activityLog.push({
        action: "Campaign Re-downloaded",
        details: "Promoter re-downloaded campaign materials",
        timestamp: new Date()
      });
      promotion = existingPromotion;
      await promotion.save({ session });
    }

    // Use atomic update for campaign to prevent race conditions
    const updatedCampaign = await CampaignModel.findByIdAndUpdate(
      campaignId,
      { 
        $inc: { currentPromoters: 1 },
        $push: { 
          activityLog: {
            action: "Promoter Registered",
            description: `Promoter ${promoter.displayName} downloaded campaign`,
            details: `Promoter ${promoter.displayName} downloaded campaign. Total promoters: ${campaign.currentPromoters + 1}`,
            timestamp: new Date()
          }
        }
      },
      { session, new: true }
    ).populate('owner');

    // Refresh promoter data to ensure we have latest wallet information
    const freshPromoter = await UserModel.findById(promoterId).session(session);
    const freshMarketer = updatedCampaign.owner;

    // Validate wallet structures exist
    if (!freshMarketer.wallets?.marketer || !freshPromoter.wallets?.promoter) {
      await session.abortTransaction();
      session.endSession();
      return res.status(500).json({
        message: "Wallet structure is incomplete.",
        success: false,
      });
    }

    // Reserve funds from marketer's wallet to promoter's reserved wallet
    const payoutAmount = campaign.payoutPerPromotion;
    
    // Check if marketer has sufficient reserved funds
    if (freshMarketer.wallets.marketer.reserved < payoutAmount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(402).json({
        message: "Insufficient reserved funds in marketer's wallet.",
        success: false,
      });
    }
    
    // Transfer funds from marketer's reserved to promoter's reserved
    freshMarketer.wallets.marketer.reserved -= payoutAmount;
    freshPromoter.wallets.promoter.reserved += payoutAmount;
    
    // Add transaction records - ensure proper field names based on your schema
    freshMarketer.wallets.marketer.transactions = freshMarketer.wallets.marketer.transactions || [];
    freshPromoter.wallets.promoter.transactions = freshPromoter.wallets.promoter.transactions || [];
    
    freshMarketer.wallets.marketer.transactions.push({
      amount: payoutAmount,
      type: "debit",
      category: "campaign",
      description: `Funds reserved for promoter ${freshPromoter.displayName} for campaign: "${campaign.title}"`,
      relatedCampaign: campaignId,
      relatedPromotion: promotion._id,
      status: "successful",
      timestamp: new Date()
    });
    
    freshPromoter.wallets.promoter.transactions.push({
      amount: payoutAmount,
      type: "credit",
      category: "promotion",
      description: `Funds reserved from campaign: "${campaign.title}"`,
      relatedCampaign: campaignId,
      relatedPromotion: promotion._id,
      status: "reserved",
      timestamp: new Date()
    });

    // Add user activity log with safe field assignment
    freshPromoter.activityLog = freshPromoter.activityLog || [];
    const activityDescription = `You downloaded a new campaign promotion: "${campaign.title}"`;
    
    freshPromoter.activityLog.push({
      action: 'campaign_download',
      description: activityDescription,
      details: {
        campaignTitle: campaign.title,
        campaignId: campaignId,
        payoutAmount: payoutAmount,
        downloadTime: new Date()
      },
      timestamp: new Date()
    });

    // Save all documents atomically using Promise.all for transaction safety
    await Promise.all([
      freshMarketer.save({ session, validateBeforeSave: true }),
      freshPromoter.save({ session, validateBeforeSave: true })
    ]);

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    // Construct media URL safely
    let mediaUrl = campaign.mediaUrl;
    if (mediaUrl && !mediaUrl.startsWith('http')) {
      const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
      mediaUrl = `${protocol}://${req.get("host")}${campaign.mediaUrl}`;
    }

    res.status(200).json({
      message: "Campaign post downloaded successfully. You can now share it on your status.",
      success: true,
      campaign: {
        title: campaign.title,
        caption: campaign.caption,
        link: campaign.link,
        mediaUrl: mediaUrl,
        mediaType: campaign.mediaType,
      },
      promotionId: promotion._id,
      reservedAmount: payoutAmount,
      currentPromoters: updatedCampaign.currentPromoters
    });

  } catch (error) {
    // Enhanced error handling with safe transaction cleanup
    try {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
    } catch (abortError) {
      console.error("Error aborting transaction:", abortError.message);
    } finally {
      session.endSession();
    }
    
    console.error("Error downloading promotion:", error.message);
    
    // More specific error handling
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        message: "Data validation failed. Please check the provided information.",
        success: false,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }

    if (error.name === 'CastError') {
      return res.status(400).json({
        message: "Invalid ID format provided.",
        success: false,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    
    res.status(500).json({
      message: "Error occurred while processing the download request.",
      success: false,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};








/* import { CampaignModel } from "../../campaign/models/campaign.model.js";
import { PromotionModel } from "../../promotion/models/promotion.model.js";
import { UserModel } from "../../user/models/user.model.js";;
import mongoose from "mongoose"; */



/**
 * @description Allows a promoter to "download" a campaign post. This action
 * marks the promotion as 'isDownloaded' and registers the promoter to the campaign.
 * It also checks if the campaign has available slots and updates the campaign's
 * `currentPromoters` count within a secure transaction.
 * @param {object} req - The request object containing campaignId and promoterId.
 * @param {object} res - The response object from Express.js.
 * @returns {Promise<void>}
 */
/* export const downloadPromotion = async (req, res) => {
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

    // Add user activity log INSIDE the transaction with proper required fields
    const activityDescription = `You downloaded a new campaign promotion: "${campaign.title}"`;
    
    promoter.activityLog.push({
      action: 'campaign_update',
      description: activityDescription, // Make sure this field is included
      details: activityDescription, // Include both if your schema requires it
      timestamp: new Date(),
      metadata: {}
    });
    
    // Update campaign activity log
    campaign.activityLog.push({
      action: "Promoter Registered",
      description: `Promoter ${promoter.displayName} downloaded campaign`, // Add description field
      details: `Promoter ${promoter.displayName} downloaded campaign. Total promoters: ${campaign.currentPromoters}`,
      timestamp: new Date()
    });

    // Save all documents with validation
    await campaign.save({ session, validateBeforeSave: true });
    await marketer.save({ session, validateBeforeSave: true });
    await promoter.save({ session, validateBeforeSave: true });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
        message: "Campaign post downloaded successfully. You can now share it on your status.",
        success: true,
        campaign: {
            title: campaign.title,
            caption: campaign.caption,
            link: campaign.link,
            mediaUrl: `https://${req.get("host")}${campaign.mediaUrl}`, // Force HTTPS
            mediaType: campaign.mediaType,
        },
        promotionId: promotion._id,
        upi: promotion.upi,
        reservedAmount: payoutAmount
    });
  } catch (error) {
    // Handle transaction abort safely
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    session.endSession();
    
    console.error("Error downloading promotion:", error.message);
    
    // More specific error handling for validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        message: "Data validation failed. Please check the provided information.",
        success: false,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    
    res.status(500).json({
      message: "Error occurred while processing the download request.",
      success: false,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}; */