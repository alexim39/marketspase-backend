import { CampaignModel } from "../../campaign/models/campaign.model.js";
import { PromotionModel } from "../../campaign/models/promotion.model.js";
import { UserModel } from "../../user/models/user.model.js";;
import mongoose from "mongoose";
import path from "path";
import fs from "fs";
import { isPromotionExpired, calculateTimeRemaining, calculateViewsNeeded, calculateProgressPercentage } from './../services/utils.js'



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
