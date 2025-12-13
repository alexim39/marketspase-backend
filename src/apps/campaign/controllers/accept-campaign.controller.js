
// apps/campaign/controllers/accept-campaign.controller.js
import mongoose from "mongoose";
import { CampaignModel } from "../models/campaign.model.js";
import { PromotionModel } from "../../promotion/models/promotion.model.js";
import { UserModel } from "../../user/models/user.model.js";
import { recordReservationTxEmbedded } from "../../user/services/transactions.service.js";
import { logUserActivity } from "../../user/services/activity.service.js";

const MAX_TX_RETRIES = 5;

function isRetryableTxnError(err) {
  return err?.errorLabels?.includes('TransientTransactionError')
      || err?.errorLabels?.includes('UnknownTransactionCommitResult')
      || /Write conflict/i.test(err?.message || '');
}

const delay = (ms) => new Promise(r => setTimeout(r, ms));

export const acceptCampaign = async (req, res) => {
  let lastErr;

  for (let attempt = 1; attempt <= MAX_TX_RETRIES; attempt++) {
    const session = await mongoose.startSession();
    try {
      const result = await session.withTransaction(async () => {
        const { campaignId } = req.params;
        const { userId } = req.body;

        // Minimal projections reduce doc size inside the txn
        const campaign = await CampaignModel
          .findById(campaignId)
          .session(session)
          .select('_id title owner status maxPromoters currentPromoters payoutPerPromotion');
        if (!campaign) throw { status: 404, message: 'Campaign not found' };
        if (campaign.status !== 'active') throw { status: 400, message: 'Campaign is not active' };

        // 1) Atomic capacity guard: only take a slot if there is one
        const slot = await CampaignModel.updateOne(
          { _id: campaign._id, status: 'active', $expr: { $lt: ['$currentPromoters', '$maxPromoters'] } },
          { $inc: { currentPromoters: 1 /* reservedAmount handled separately if used */ } },
          { session }
        );
        if (!slot.modifiedCount) throw { status: 409, message: 'No available slots on this campaign' };

        // 2) Uniqueness for pending promotion (best-effort; reinforce with index below)
        const existing = await PromotionModel
          .findOne({ campaign: campaign._id, promoter: userId, status: 'pending' })
          .session(session)
          .select('_id');
        if (existing) throw { status: 409, message: 'You already have a pending promotion for this campaign' };

        // 3) Wallet reservation (guard against negatives)
        const payout = Number(campaign.payoutPerPromotion ?? 0);
        if (!Number.isFinite(payout) || payout <= 0) throw { status: 400, message: 'Invalid campaign payout amount' };

        const marketer = await UserModel.findById(campaign.owner).session(session).select('_id');
        if (!marketer) throw { status: 404, message: 'Campaign owner not found' };

        const ok = await UserModel.updateOne(
          { _id: marketer._id, 'wallets.marketer.balance': { $gte: payout } },
          { $inc: { 'wallets.marketer.balance': -payout, 'wallets.marketer.reserved': +payout } },
          { session }
        );
        if (!ok.modifiedCount) throw { status: 402, message: 'Insufficient marketer balance for reservation' };

        // 4) Create promotion (mark as reserved immediately)
        const promotion = await new PromotionModel({
          campaign: campaign._id,
          promoter: userId,
          status: 'pending',
          payoutAmount: payout,
          hasReservedFromMarketer: true,
          acceptedAt: new Date()
        }).save({ session });

        // 5) Idempotent transaction record
        const operationId = `reserve:${promotion._id}`;
        await recordReservationTxEmbedded({
          session, operationId,
          campaignId: campaign._id,
          promotionId: promotion._id,
          marketerId: marketer._id,
          promoterId: userId,
          amount: payout
        });

        // 6) Activity log
        await logUserActivity({
          session,
          userId,
          action: 'campaign_update',
          description: `You accepted campaign: "${campaign.title}"`,
          resourceType: 'campaign',
          resourceId: campaign._id,
          metadata: { payout, promotionId: promotion._id }
        });

        return { promotion, reservedAmount: payout, campaignStatus: 'active' };
      }, {
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
        maxCommitTimeMS: 10000
      });

      await session.endSession();
      return res.json({
        success: true,
        message: 'Campaign accepted successfully! You can now download the promotion materials.',
        promotion: result.promotion,
        campaignStatus: result.campaignStatus,
        reservedAmount: result.reservedAmount
      });
    } catch (err) {
      await session.endSession();
      // Retry only transient conflicts; surface app errors immediately
      if (isRetryableTxnError(err) && attempt < MAX_TX_RETRIES) {
        const backoff = Math.min(800, 50 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 50);
        await delay(backoff);
        lastErr = err;
        continue;
      }
      if (err?.status) return res.status(err.status).json({ success: false, message: err.message });
      console.error('Error accepting campaign:', err);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // If we got here, repeated transient conflicts under high load
  return res.status(503).json({ success: false, message: 'Please retry. High load caused transient write conflict.' });
};



/* // apps/campaign/controllers/accept-campaign.controller.js
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
        amount: payout
      });

      
      // Set hasReservedFromMarketer flag on the promotion
      await PromotionModel.updateOne(
        { _id: promotion._id },
        { $set: { hasReservedFromMarketer: true } },
        { session }
      );


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
 */