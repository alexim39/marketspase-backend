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

  try {
    // run logic inside withTransaction so driver can retry transient errors
    const result = await session.withTransaction(async () => {
      const { campaignId } = req.params;
      const { userId } = req.body;

      // 1. Find resources with session
      const campaign = await CampaignModel.findById(campaignId).session(session);
      const promoter = await UserModel.findById(userId).session(session);
      const marketer = await UserModel.findById(campaign?.owner).session(session);

      // On validation failures, throw an object; withTransaction will abort automatically
      if (!campaign) throw { status: 404, message: 'Campaign not found' };
      if (!promoter) throw { status: 404, message: 'Promoter user not found' };
      if (!marketer) throw { status: 404, message: 'Campaign owner not found' };
      if (campaign.status !== 'active') throw { status: 400, message: 'Campaign is not active' };

      // Check pending-only uniqueness
      const existingPendingPromotion = await PromotionModel.findOne({
        campaign: campaignId,
        promoter: userId,
        status: 'pending'
      }).session(session);
      console.log('existingPendingPromotion', existingPendingPromotion);
      if (existingPendingPromotion) throw { status: 400, message: 'You have already accepted this campaign and your acceptance is still pending' };

      // determine payout and validate
      const payoutAmount = Number(campaign?.payoutPerPromotion ?? 0);
      if (!Number.isFinite(payoutAmount) || payoutAmount <= 0) {
        throw { status: 400, message: 'Invalid campaign payout amount' };
      }

      // If there's an existing PENDING promotion for this promoter+campaign, block.
      // Otherwise ALWAYS create a NEW promotion document (do not reuse or modify old non-pending records).
      if (existingPendingPromotion) {
        throw { status: 400, message: 'You have already accepted this campaign and your acceptance is still pending' };
      }

      // Create a brand new promotion record
      let promotion;
      try {
        promotion = await new PromotionModel({
          campaign: campaignId,
          promoter: userId,
          status: 'pending',
          payoutAmount,
          notes: 'Campaign accepted by promoter, awaiting download',
          createdAt: new Date(),
          updatedAt: new Date()
        }).save({ session });
      } catch (err) {
        // Handle race / unique-index conflicts gracefully
        if (err && err.code === 11000) {
          // Duplicate key -> another process created a pending promotion concurrently
          throw { status: 409, message: 'You have already accepted this campaign (pending promotion exists)' };
        }
        throw err;
      }

      // Reserve funds from marketer
      marketer.wallets.marketer.balance -= payoutAmount;
      marketer.wallets.marketer.reserved += payoutAmount;
      marketer.wallets.marketer.transactions.push({
        amount: payoutAmount,
        type: 'debit',
        category: 'campaign',
        description: `Funds reserved for campaign: "${campaign.title}"`,
        relatedCampaign: campaignId,
        relatedPromotion: promotion._id,
        status: 'reserved',
        timestamp: new Date()
      });

      // Update campaign
      campaign.assignPromoter();
      campaign.spentBudget = (campaign.spentBudget || 0) + payoutAmount;

      // Push activity via atomic update
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
              $slice: 1000
            }
          }
        },
        { session }
      );

      // Save documents within the same session
      await Promise.all([
        marketer.save({ session }),
        campaign.save({ session }),
        promoter.save({ session })
      ]);

      // return data to outer scope for response
      return { promotion, campaignStatus: campaign.status, reservedAmount: payoutAmount };
    }, {
      // optional transaction options
      readPreference: 'primary',
      readConcern: { level: 'local' },
      writeConcern: { w: 'majority' }
    });

    // on success, send response (withTransaction committed)
    res.json({
      success: true,
      message: 'Campaign accepted successfully! You can now download the promotion materials.',
      promotion: result.promotion,
      campaignStatus: result.campaignStatus,
      reservedAmount: result.reservedAmount
    });

  } catch (error) {
    // handle controlled (thrown) HTTP errors first
    if (error && typeof error === 'object' && error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }

    // transient/other errors
    console.error('Error accepting campaign:', error);
    const message = (error && error.code === 11000) ? 'You have already accepted this campaign (pending exists)' : 'Internal server error';
    res.status(500).json({ success: false, message });
  } finally {
    // always end the session
    await session.endSession();
  }
};