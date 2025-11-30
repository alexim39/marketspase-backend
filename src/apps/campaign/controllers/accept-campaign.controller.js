
// apps/campaign/controllers/accept-campaign.controller.js
import mongoose from "mongoose";
import { CampaignModel } from "../models/campaign.model.js";
import { PromotionModel } from "../../promotion/models/promotion.model.js";
import { UserModel } from "../../user/models/user.model.js";
import { recordReservationTxEmbedded } from "../../user/services/transactions.service.js";
import { logUserActivity } from "../../user/services/activity.service.js";

export const acceptCampaign = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const result = await session.withTransaction(async () => {
      const { campaignId } = req.params;
      const { userId } = req.body;

      const campaign = await CampaignModel.findById(campaignId).session(session);
      if (!campaign) throw { status: 404, message: 'Campaign not found' };
      if (campaign.status !== 'active') throw { status: 400, message: 'Campaign is not active' };

      const promoter = await UserModel.findById(userId).session(session);
      if (!promoter) throw { status: 404, message: 'Promoter user not found' };

      const marketer = await UserModel.findById(campaign.owner).session(session);
      if (!marketer) throw { status: 404, message: 'Campaign owner not found' };

      // uniqueness for pending
      const existing = await PromotionModel.findOne({ campaign: campaignId, promoter: userId, status: 'pending' }).session(session);
      if (existing) throw { status: 409, message: 'You already have a pending promotion for this campaign' };

      // payout in minor units
      const payout = Number(campaign.payoutPerPromotion ?? 0);
      if (!Number.isFinite(payout) || payout <= 0) throw { status: 400, message: 'Invalid campaign payout amount' };

      // create pending promotion
      const promotion = await new PromotionModel({
        campaign: campaignId,
        promoter: userId,
        status: 'pending',
        payoutAmount: payout,
        acceptedAt: new Date()
      }).save({ session });

      // guarded reservation (no negatives)
      const ok = await UserModel.updateOne(
        { _id: marketer._id, 'wallets.marketer.balance': { $gte: payout } },
        { $inc: { 'wallets.marketer.balance': -payout, 'wallets.marketer.reserved': +payout } },
        { session }
      );
      if (!ok.modifiedCount) throw { status: 402, message: 'Insufficient marketer balance for reservation' };

      // campaign capacity + reserved snapshot
      await CampaignModel.updateOne(
        { _id: campaign._id },
        { $inc: { currentPromoters: 1, reservedAmount: payout } },
        { session }
      );

      // idempotent transaction record
      const operationId = `reserve:${promotion._id}`;
      await recordReservationTxEmbedded({
        session, operationId,
        campaignId: campaign._id,
        promotionId: promotion._id,
        marketerId: marketer._id,
        promoterId: promoter._id,
        payout
      });

      // promoter activity log
      await logUserActivity({
        session,
        userId: promoter._id,
        action: 'campaign_update',
        description: `You accepted campaign: "${campaign.title}"`,
        resourceType: 'campaign',
        resourceId: campaign._id,
        metadata: { payout, promotionId: promotion._id }
      });

      return { promotion, reservedAmount: payout, campaignStatus: campaign.status };
    }, { writeConcern: { w: 'majority' } });

    res.json({
      success: true,
      message: 'Campaign accepted successfully! You can now download the promotion materials.',
      promotion: result.promotion,
      campaignStatus: result.campaignStatus,
      reservedAmount: result.reservedAmount
    });
  } catch (error) {
    if (error && error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error('Error accepting campaign:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    await session.endSession();
  }
};
