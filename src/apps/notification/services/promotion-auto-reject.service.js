// src/apps/notification/services/promotion-auto-reject.service.js

import { CampaignModel } from './../../campaign/models/campaign.model.js';
import { PromotionModel } from './../../promotion/models/promotion.model.js';
import { NotificationService } from './notification.service.js';
import mongoose from 'mongoose';
import {
  moveWithinWallet,
  moveBetweenWallets
} from "../../wallet/services/wallet-move.service.js";

export const promotionAutoRejection = async () => {
  const jobStartTime = new Date();
  console.log(`🕒 [${jobStartTime.toISOString()}] Auto-Reject expired promotions started`);

  try {
    const threshold = new Date(Date.now() - 24 * 60 * 60 * 1000);

    /**
     * 🔐 IDEMPOTENCY GUARD #1 (QUERY-LEVEL)
     * We only pick promotions that were NEVER auto-rejected before
     */
    const expiredPromotions = await PromotionModel.find({
      status: { $in: ["accepted", "downloaded"] },
      createdAt: { $lte: threshold },
      autoRejectedAt: { $exists: false }
    })
      .select('_id status createdAt isDownloaded promoter campaign payoutAmount')
      .populate({ path: "promoter", select: "_id displayName email wallets", options: { lean: true } })
      .populate({
        path: "campaign",
        select: "_id title budget spentBudget status owner",
        populate: { path: "owner", model: "User", select: "_id displayName email wallets", options: { lean: true } },
        options: { lean: true }
      })
      .lean();

    console.log(`📊 Found ${expiredPromotions.length} expired promotions`);

    let rejected = 0;
    let failed = 0;

    for (const promotion of expiredPromotions) {
      const promoter = promotion.promoter;
      const campaign = promotion.campaign;
      const marketer = campaign?.owner;

      /**
       * 🔐 New rule:
       * NEVER compute payout here.
       * Only refund what was actually reserved.
       */
      const reservedAmount = Number(promotion.payoutAmount || 0);

      const SCENARIO = promotion.isDownloaded
        ? "Downloaded but NOT submitted"
        : "Accepted but NOT downloaded";

      const session = await mongoose.startSession();

      try {
        await session.startTransaction();

        /**
         * 🔐 IDEMPOTENCY GUARD #2 (ATOMIC UPDATE)
         * If this update affects 0 docs, it means another worker already handled it
         */
        const rejectResult = await PromotionModel.updateOne(
          {
            _id: promotion._id,
            //status: "pending",
            autoRejectedAt: { $exists: false }
          },
          {
            $set: {
              status: "rejected",
              rejectionReason: `Promotion expired — ${SCENARIO}`,
              autoRejectedAt: new Date()
            },
            $push: {
              activityLog: {
                action: "Auto-Rejected",
                details: `Expired after 24 hours. ${SCENARIO}.`,
                timestamp: new Date()
              }
            }
          },
          { session }
        );

        if (rejectResult.modifiedCount === 0) {
          // Already handled elsewhere — exit safely
          await session.abortTransaction();
          session.endSession();
          continue;
        }

        /**
         * 💰 WALLET LOGIC (SAFE, IDEMPOTENT)
         */
        if (!promotion.isDownloaded) {
          /**
           * Scenario A:
           * marketer.reserved → marketer.balance
           */
          if (reservedAmount > 0) {
            await moveWithinWallet({
              session,
              userId: campaign.owner,
              side: "marketer",
              incReserved: -reservedAmount,
              incBalance: +reservedAmount
            });
          }

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
          /**
           * Scenario B:
           * promoter.reserved → marketer.balance
           */
          if (reservedAmount > 0) {
            await moveBetweenWallets({
              session,
              fromUserId: promoter._id,
              fromSide: "promoter",
              fromField: "reserved",
              toUserId: marketer._id,
              toSide: "marketer",
              toField: "balance",
              amount: reservedAmount
            });
          }

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


        /**
         * 📊 Campaign counters (NO payout math)
         */
        await CampaignModel.updateOne(
          { _id: campaign._id },
          {
            $inc: {
              currentPromoters: -1,
              totalPromotions: -1
            },
            $push: {
              activityLog: {
                action: "Promotion Auto-Rejected",
                details: `Promotion ${promotion._id} auto-rejected. ${SCENARIO}.`,
                timestamp: new Date()
              }
            }
          },
          { session }
        );

        await session.commitTransaction();
        session.endSession();
        rejected++;

      } catch (err) {
        failed++;
        await session.abortTransaction().catch(() => {});
        session.endSession();
        console.error(`❌ Failed to auto-reject promotion ${promotion._id}:`, err);
      }

      /**
       * 🔔 Notifications (safe outside transaction)
       */
      await NotificationService.createNotification({
        recipient: promoter._id,
        type: "promotion_rejected",
        title: "Promotion Expired ⏰",
        message: `Your promotion for "${campaign.title}" expired after 24 hours (${SCENARIO}).`,
        data: { campaignId: campaign._id, promotionId: promotion._id },
        priority: "medium"
      });

      await NotificationService.createNotification({
        recipient: marketer._id,
        type: "refund_processed",
        title: "Funds Refunded",
        message: `₦${reservedAmount} refunded for expired promotion: "${campaign.title}"`,
        priority: "medium"
      });
    }

    const end = new Date();
    console.log(
      `🎉 Auto-Reject DONE — rejected: ${rejected}, failed: ${failed}, duration: ${(end - jobStartTime) / 1000}s`
    );

  } catch (err) {
    console.error("❌ Auto-Reject job failed:", err);
  }
};
