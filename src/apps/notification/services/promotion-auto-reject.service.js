
// src/apps/notification/services/promotion-auto-reject.service.js
import { CampaignModel }  from './../../campaign/models/campaign.model.js';
import { PromotionModel } from './../../promotion/models/promotion.model.js';
import { UserModel }      from './../../user/models/user.model.js';
import { NotificationService } from './notification.service.js';
import mongoose from 'mongoose';
import { moveWithinWallet, moveBetweenWallets } from "../../wallet/services/wallet-move.service.js";

export const promotionAutoRejection = async () => {
  const jobStartTime = new Date();
  console.log(`🕒 [${jobStartTime.toISOString()}] Auto-Reject expired promotions started`);

  try {
    const threshold = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const expiredPromotions = await PromotionModel.find({
      status: "pending",
      createdAt: { $lte: threshold }
    })
    .populate("promoter", "displayName email wallets")
    .populate({ path: "campaign", populate: { path: "owner", model: "User", select: "displayName email wallets" } });

    console.log(`📊 Found ${expiredPromotions.length} expired promotions`);

    let rejected = 0, failed = 0;

    for (const promotion of expiredPromotions) {
      if (promotion.status !== "pending") continue; // safety
      const promoter = promotion.promoter;
      const campaign = promotion.campaign;
      const marketer = campaign.owner;
      const payoutAmount = Number(promotion.payoutAmount ?? campaign.payoutPerPromotion ?? 0);
      const SCENARIO = promotion.isDownloaded === true ? "Downloaded but NOT submitted" : "Accepted but NOT downloaded";

      const session = await mongoose.startSession();
      try {
        await session.startTransaction();

        // mark promotion rejected
        await PromotionModel.updateOne(
          { _id: promotion._id },
          {
            $set: { status: "rejected", rejectionReason: `Promotion expired — ${SCENARIO}` },
            $push: { activityLog: { action: "Auto-Rejected", details: `Expired after 24 hours. ${SCENARIO}.`, timestamp: new Date() } }
          },
          { session }
        );

        if (!promotion.isDownloaded) {
          // Scenario A: accepted but never downloaded -> refund marketer.reserved -> marketer.balance
          await moveWithinWallet({
            session, userId: marketer._id, side: 'marketer',
            incReserved: -payoutAmount, incBalance: +payoutAmount
          });

          await UserModel.updateOne(
            { _id: marketer._id },
            {
              $push: {
                "wallets.marketer.transactions": {
                  amount: payoutAmount, type: "credit", category: "refund",
                  description: `Refund for unclaimed promotion: ${campaign.title}`,
                  relatedCampaign: campaign._id, relatedPromotion: promotion._id,
                  status: "successful", createdAt: new Date()
                }
              }
            },
            { session }
          );

         // Set refund and escrow flags
          await PromotionModel.updateOne(
            { _id: promotion._id },
            {
              $set: {
                hasBeenRefunded: true,
                hasReservedFromMarketer: false
              }
            },
            { session }
          );

        } else {
          // Scenario B: downloaded but NOT submitted -> promoter.reserved -> marketer.balance
          await moveBetweenWallets({
            session,
            fromUserId: promoter._id, fromSide: 'promoter', fromField: 'reserved',
            toUserId: marketer._id,   toSide: 'marketer',   toField: 'balance',
            amount: payoutAmount
          });

          await UserModel.updateOne(
            { _id: promoter._id },
            {
              $push: {
                "wallets.promoter.transactions": {
                  amount: payoutAmount, type: "debit", category: "refund",
                  description: `Reserved funds released for expired promotion: ${campaign.title}`,
                  relatedCampaign: campaign._id, relatedPromotion: promotion._id,
                  status: "reversed", createdAt: new Date()
                }
              }
            },
            { session }
          );

          await UserModel.updateOne(
            { _id: marketer._id },
            {
              $push: {
                "wallets.marketer.transactions": {
                  amount: payoutAmount, type: "credit", category: "refund",
                  description: `Refund received for expired promotion: ${promotion.upi || promotion._id}`,
                  relatedCampaign: campaign._id, relatedPromotion: promotion._id,
                  status: "successful", createdAt: new Date()
                }
              }
            },
            { session }
          );
          
          // Set refund and escrow flags
          await PromotionModel.updateOne(
            { _id: promotion._id },
            {
              $set: {
                hasBeenRefunded: true,
                hasReservedForPromoter: false
              }
            },
            { session }
          );

        }

        // update campaign slot; optional reactivation
        const campaignUpdate = {
          $inc: { 
            currentPromoters: -1,
            totalPromotions: -1
          },
          $push: { activityLog: { action: "Promotion Auto-Rejected", details: `Promotion ${promotion._id} auto-rejected. ${SCENARIO}.`, timestamp: new Date() } }
        };
        if (campaign.status === "exhausted") {
          const remaining = (campaign.budget ?? 0) - (campaign.spentBudget ?? 0);
          if (remaining >= (campaign.payoutPerPromotion ?? payoutAmount)) {
            campaignUpdate.$set = { status: "active" };
          }
        }
        await CampaignModel.updateOne({ _id: campaign._id }, campaignUpdate, { session });
        // Trigger pre-save hook to recalculate spentBudget
        const updatedCampaignDoc = await CampaignModel.findById(campaign._id).session(session);
        if (updatedCampaignDoc) await updatedCampaignDoc.save({ session })

        await session.commitTransaction(); session.endSession();
        rejected++;
      } catch (err) {
        failed++;
        await session.abortTransaction().catch(() => {});
        session.endSession();
        console.error(`Failed to auto-reject promotion ${promotion._id}:`, err);
      }

      // notifications outside transaction (or adopt outbox later)
      await NotificationService.createNotification({
        recipient: promoter._id,
        type: "promotion_rejected",
        title: "Promotion Expired ⏰",
        message: `Your promotion for "${campaign.title}" expired after 24 hours (${SCENARIO}).`,
        data: { campaignId: campaign._id, promotionId: promotion._id, scenario: SCENARIO },
        priority: "medium"
      });

      await NotificationService.createNotification({
        recipient: marketer._id,
        type: "refund_processed",
        title: "Funds Refunded",
        message: `₦${payoutAmount} refunded for expired promotion: "${campaign.title}"`,
        priority: "medium"
      });
    }

    const end = new Date();
    console.log(`🎉 Auto-Reject job DONE — rejected: ${rejected}, failed: ${failed}, duration: ${(end - jobStartTime)/1000}s`);
  } catch (err) {
    console.error("❌ Auto-Reject job failed:", err);
  }
};
