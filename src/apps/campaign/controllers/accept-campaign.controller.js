import { CampaignModel } from "../models/campaign.model.js";
import { PromotionModel } from "../models/promotion.model.js";
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
    

    // 6. Update wallet balances within the transaction
    // Deduct from marketer's reserved wallet
    // marketer.wallets.marketer.reserved = (marketer.wallets.marketer.reserved || 0) - payoutAmount;
    // marketer.wallets.marketer.transactions.push({
    //   amount: payoutAmount,
    //   type: "debit",
    //   category: "campaign",
    //   description: `Funds transferred to promoter for campaign: "${campaign.title}"`,
    //   relatedCampaign: campaignId,
    //   status: "successful",
    // });

    // Credit promoter's reserved wallet
    // promoter.wallets.promoter.reserved = (promoter.wallets.promoter.reserved || 0) + payoutAmount;
    // promoter.wallets.promoter.transactions.push({
    //   amount: payoutAmount,
    //   type: "credit",
    //   category: "promotion",
    //   description: `Funds reserved from campaign: "${campaign.title}"`,
    //   relatedCampaign: campaignId,
    //   relatedPromotion: promotion._id,
    //   status: "successful",
    // });

    // 7. Update campaign using the assignPromoter method
    //campaign.assignPromoter();
    
    // IMPORTANT: Update spentBudget to reflect the reserved funds
    // This ensures the campaign budget tracking is accurate
    //campaign.spentBudget += payoutAmount;
    
    // Check if the campaign should be marked as exhausted
    // if (campaign.spentBudget >= campaign.budget || campaign.totalPromotions >= campaign.maxPromoters) {
    //   campaign.status = 'exhausted';
    //   campaign.activityLog.push({
    //     action: "Campaign Exhausted",
    //     details: `Campaign budget exhausted after ${campaign.totalPromotions} promotions`,
    //     timestamp: new Date()
    //   });
    // }

    // 8. Save all documents
    //await marketer.save({ session });
    await promoter.save({ session });
    await campaign.save({ session });
    
    // 9. Commit the transaction
    await session.commitTransaction();
    session.endSession();

    // 10. Send success response
    res.json({
      success: true,
      message: 'Promotion accepted. Funds have been reserved for you. Check your promotion page to submit completion proof.',
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





