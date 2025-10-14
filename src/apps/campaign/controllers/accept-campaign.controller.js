import { CampaignModel } from "../models/campaign.model.js";
import { PromotionModel } from "../../promotion/models/promotion.model.js";
import { UserModel } from "../../user/models/user.model.js";
import mongoose from "mongoose";
import fs from "fs"; // Add this import
import path from "path"; // Useful for path operations


/**
 * @description Allows a promoter to accept a campaign, creating a promotion record
 * and securely updating the reserved funds in both the marketer's and promoter's
 * wallets using a database transaction.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 * @returns {Promise<void>}
 */
export const acceptCampaign = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { campaignId } = req.params;
    const { userId } = req.body;

    // 1. Find the campaign and the promoter within the transaction
    const campaign = await CampaignModel.findById(campaignId).session(session);
    const promoter = await UserModel.findById(userId).session(session);

    // 2. Initial validation
    if (!campaign) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }
    if (!promoter) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Promoter user not found' });
    }
    if (campaign.status !== 'active') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Campaign is not active' });
    }

    // 3. Check for existing promotion record
    const existingPromotion = await PromotionModel.findOne({
      campaign: campaignId,
      promoter: userId
    }).session(session);
    if (existingPromotion) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'You have already accepted this campaign' });
    }

    // 4. Check if campaign can accept more promoters
    if (!campaign.canAssignPromoter()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Campaign is full or budget exhausted' });
    }

    const payoutAmount = campaign.payoutPerPromotion;
    //const marketer = await UserModel.findById(campaign.owner).session(session);

    // if (!marketer) {
    //   await session.abortTransaction();
    //   session.endSession();
    //   return res.status(500).json({ success: false, message: 'Campaign owner not found.' });
    // }

    // 5. Create promotion record with the session first to get its _id
    const promotion = new PromotionModel({
      campaign: campaignId,
      promoter: userId,
      status: 'pending',
      payoutAmount: payoutAmount
    });
    await promotion.save({ session });
    
    // 8. Save all documents
    //await marketer.save({ session });
    await promoter.save({ session });
    await campaign.save({ session });
    
    // 9. Commit the transaction
    await session.commitTransaction();
    session.endSession();

    // user activity log
    await promoter.logActivity('campaign_update', `You accepted a new campaign promotion`, {});

    // 10. Send success response
    res.json({
      success: true,
      message: 'Your promotion\'s accepted! Head to My Promotion page to download files and lock in your funds.',
      promotion: promotion,
      campaignStatus: campaign.status,
      remainingBudget: campaign.remainingBudget
    });

  } catch (error) {
    // 11. Rollback transaction on error
    await session.abortTransaction();
    session.endSession();
    console.error('Error accepting campaign:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};





