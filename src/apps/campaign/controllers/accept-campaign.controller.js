import { CampaignModel } from "../models/campaign.model.js";
import { PromotionModel } from "../../promotion/models/promotion.model.js";
import { UserModel } from "../../user/models/user.model.js";
import mongoose from "mongoose";

/**
 * @description Allows a promoter to accept a campaign, creating a promotion record
 * without financial operations. Financial operations will be handled in downloadPromotion.
 */
export const acceptCampaign = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { campaignId } = req.params;
    const { userId } = req.body;

    // 1. Find the campaign, promoter, and marketer within the transaction
    const campaign = await CampaignModel.findById(campaignId).session(session);
    const promoter = await UserModel.findById(userId).session(session);
    const marketer = await UserModel.findById(campaign.owner).session(session);

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
    if (!marketer) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Campaign owner not found' });
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

    // 4. Check if campaign can accept more promoters using model method
    if (!campaign.canAssignPromoter()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Campaign is full or budget exhausted' });
    }

    const payoutAmount = campaign.payoutPerPromotion;

    // 5. Validate marketer has sufficient funds in nested wallet structure
    if (marketer.wallets.marketer.balance < payoutAmount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        success: false, 
        message: 'Marketer has insufficient funds for this campaign' 
      });
    }

    // 6. Create promotion record with pending status
    const promotion = new PromotionModel({
      campaign: campaignId,
      promoter: userId,
      status: 'pending',
      payoutAmount: payoutAmount,
      notes: "Campaign accepted by promoter, awaiting download"
    });
    await promotion.save({ session });

    // ✅ SAVE PROMOTION FIRST (this will trigger notifications in post-save)
    await promotion.save({ session });

    // 7. Reserve funds from marketer's wallet (move from balance to reserved)
    marketer.wallets.marketer.balance -= payoutAmount;
    marketer.wallets.marketer.reserved += payoutAmount;
    
    // Add transaction record for marketer
    marketer.wallets.marketer.transactions.push({
      amount: payoutAmount,
      type: "debit",
      category: "campaign",
      description: `Funds reserved for campaign: "${campaign.title}"`,
      relatedCampaign: campaignId,
      relatedPromotion: promotion._id,
      status: "reserved",
      timestamp: new Date()
    });

    // 8. Update campaign state using model method
    campaign.assignPromoter();
    campaign.spentBudget = (campaign.spentBudget || 0) + payoutAmount;

    // 9. ✅ USE ATOMIC UPDATE FOR ACTIVITY LOG TO AVOID VERSION CONFLICTS
    await UserModel.updateOne(
      { _id: promoter._id },
      { 
        $push: { 
          activityLog: {
            $each: [{
              action: 'campaign_update',
              description: `You accepted campaign: "${campaign.title}"`,
              resourceType: 'campaign',
              resourceId: campaignId,
              metadata: { payoutAmount, promotionId: promotion._id },
              timestamp: new Date()
            }],
            $position: 0,
            $slice: 1000 // Keep only latest 1000 activities
          }
        } 
      },
      { session }
    );

    // 10. Save all documents including promoter with activity log
    await Promise.all([
      marketer.save({ session }),
      campaign.save({ session }),
      promoter.save({ session })
    ]);
    
    // 11. Commit the transaction
    await session.commitTransaction();
    session.endSession();

    // 12. Send success response
    res.json({
      success: true,
      message: 'Campaign accepted successfully! You can now download the promotion materials.',
      promotion: promotion,
      campaignStatus: campaign.status,
      reservedAmount: payoutAmount
    });

  } catch (error) {
    // 13. Rollback transaction on error
    await session.abortTransaction();
    session.endSession();
    console.error('Error accepting campaign:', error);
    
// Provide more specific error messages based on error type
    let errorMessage = 'Internal server error';
    if (error.name === 'ValidationError') {
      errorMessage = 'Data validation failed';
    } else if (error.name === 'CastError') {
      errorMessage = 'Invalid data format';
    } else if (error.name === 'VersionError') {
      errorMessage = 'Data conflict. Please try again.';
    } else if (error.name === 'ParallelSaveError') {
      errorMessage = 'System busy. Please try again.';
    }
    
    res.status(500).json({ 
      success: false, 
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};