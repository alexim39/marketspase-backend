// src/apps/notification/services/promotion-auto-reject.service.js

import mongoose from "mongoose";
import { CampaignModel } from "../../campaign/models/campaign.model.js";
import { PromotionModel } from "../../promotion/models/promotion.model.js";
import { NotificationService } from "./notification.service.js";
import {
  moveBetweenWallets,
  moveWithinWallet,
} from "../../wallet/services/wallet-move.service.js";

const AUTO_REJECT_WINDOW_MS = 24 * 60 * 60 * 1000;

const getExpiredPromotionScenario = (promotion) =>
  promotion?.isDownloaded
    ? "Downloaded but NOT submitted"
    : "Accepted but NOT downloaded";

const resolveReservedAmount = (promotion, campaign) => {
  const candidates = [
    promotion?.payoutSnapshot?.payoutAmount,
    promotion?.payoutAmount,
    campaign?.payoutPerPromotion,
  ];

  for (const candidate of candidates) {
    const amount = Number(candidate);
    if (Number.isFinite(amount) && amount > 0) {
      return amount;
    }
  }

  return 0;
};

export const promotionAutoRejection = async () => {
  const jobStartTime = new Date();
  console.log(
    `[${jobStartTime.toISOString()}] Auto-reject expired promotions started`
  );

  try {
    const threshold = new Date(Date.now() - AUTO_REJECT_WINDOW_MS);

    const expiredPromotions = await PromotionModel.find({
      status: { $in: ["accepted", "downloaded"] },
      createdAt: { $lte: threshold },
      autoRejectedAt: { $exists: false },
    })
      .select(
        "_id status createdAt isDownloaded isActive promoter campaign payoutAmount payoutSnapshot hasReservedFromMarketer hasReservedForPromoter"
      )
      .populate({
        path: "promoter",
        select: "_id displayName email",
        options: { lean: true },
      })
      .populate({
        path: "campaign",
        select:
          "_id title budget spentBudget status owner payoutPerPromotion costPerClick",
        populate: {
          path: "owner",
          model: "User",
          select: "_id displayName email",
          options: { lean: true },
        },
        options: { lean: true },
      })
      .lean();

    console.log(`Found ${expiredPromotions.length} expired promotions`);

    let rejected = 0;
    let failed = 0;

    for (const promotion of expiredPromotions) {
      const promoter = promotion?.promoter;
      const campaign = promotion?.campaign;
      const marketer = campaign?.owner;

      if (!promoter?._id || !campaign?._id || !marketer?._id) {
        failed++;
        console.warn(
          `Skipping auto-reject for promotion ${promotion?._id}: missing promoter, campaign, or marketer reference.`
        );
        continue;
      }

      const scenario = getExpiredPromotionScenario(promotion);
      const reservedAmount = resolveReservedAmount(promotion, campaign);
      const hasLegacyReserveFlags = Boolean(
        promotion?.hasReservedFromMarketer || promotion?.hasReservedForPromoter
      );
      const needsManualReserveReview =
        hasLegacyReserveFlags && reservedAmount <= 0;
      const shouldReversePromoterReserve =
        Boolean(promotion?.hasReservedForPromoter) && reservedAmount > 0;
      const shouldReleaseMarketerReserve =
        !shouldReversePromoterReserve &&
        Boolean(promotion?.hasReservedFromMarketer) &&
        reservedAmount > 0;
      let refundedAmount = 0;
      let refundFailureReason = "";
      const rejectionDetailsBase = needsManualReserveReview
        ? `Expired after 24 hours. ${scenario}. Reserved-funds flags were present but no reversible amount could be resolved; review wallet history manually.`
        : `Expired after 24 hours. ${scenario}.`;
      const session = await mongoose.startSession();
      let committed = false;

      try {
        await session.startTransaction();

        const rejectResult = await PromotionModel.updateOne(
          {
            _id: promotion._id,
            status: { $in: ["accepted", "downloaded"] },
            autoRejectedAt: { $exists: false },
          },
          {
            $set: {
              status: "rejected",
              isActive: false,
              rejectedAt: new Date(),
              rejectionReason: `Promotion expired - ${scenario}`,
              autoRejectedAt: new Date(),
            },
            $push: {
              activityLog: {
                action: "Auto-Rejected",
                details: rejectionDetailsBase,
                timestamp: new Date(),
              },
            },
          },
          { session }
        );

        if (rejectResult.modifiedCount === 0) {
          await session.abortTransaction();
          continue;
        }

        // Wallet reversal is best-effort. If it fails due to insufficient funds (or inconsistent legacy flags), 
        // we still commit the auto-rejection so the job doesn't retry forever; the wallet state is then flagged 
        // for manual reconciliation via activity logs + retained reserve flags. 
        let walletReversalSucceeded = false; 
        if (shouldReversePromoterReserve) { 
          try { 
            const ok = await moveBetweenWallets({ 
              session, 
              fromUserId: promoter._id, 
              fromSide: "promoter", 
              fromField: "reserved", 
              toUserId: marketer._id, 
              toSide: "marketer", 
              toField: "balance", 
              amount: reservedAmount, 
              throwOnFailure: false,
            }); 
            walletReversalSucceeded = Boolean(ok); 
            if (!ok) { 
              refundFailureReason = "Promoter reserved balance was insufficient for reversal."; 
            } 
          } catch (err) { 
            refundFailureReason = err?.message || "Failed to reverse promoter reserved funds."; 
          } 
        } else if (shouldReleaseMarketerReserve) { 
          try { 
            const ok = await moveWithinWallet({ 
              session, 
              userId: marketer._id, 
              side: "marketer", 
              incReserved: -reservedAmount, 
              incBalance: +reservedAmount, 
              throwOnFailure: false,
            }); 
            walletReversalSucceeded = Boolean(ok); 
            if (!ok) { 
              refundFailureReason = "Marketer reserved balance was insufficient for release."; 
            } 
          } catch (err) { 
            refundFailureReason = err?.message || "Failed to release marketer reserved funds."; 
          } 
        } 

        if (walletReversalSucceeded) {
          refundedAmount = reservedAmount;
        }

        const rejectionDetails = refundFailureReason
          ? `${rejectionDetailsBase} Wallet reversal failed: ${refundFailureReason}`
          : rejectionDetailsBase;

        await PromotionModel.updateOne(
          { _id: promotion._id },
          {
            $set: {
              hasBeenRefunded:
                refundedAmount > 0 || (!hasLegacyReserveFlags && !refundFailureReason),
              hasReservedFromMarketer:
                // Keep flags when wallet reversal is ambiguous/failing so finance/admin can reconcile later.
                needsManualReserveReview || Boolean(refundFailureReason)
                  ? Boolean(promotion?.hasReservedFromMarketer)
                  : false,
              hasReservedForPromoter:
                needsManualReserveReview || Boolean(refundFailureReason)
                  ? Boolean(promotion?.hasReservedForPromoter)
                  : false,
            },
            ...(refundFailureReason
              ? {
                  $push: {
                    activityLog: {
                      action: "Wallet Reversal Pending",
                      details: `Auto-reject wallet reversal failed: ${refundFailureReason}`,
                      timestamp: new Date(),
                    },
                  },
                }
              : {}),
          },
          { session }
        );

        await CampaignModel.updateOne(
          { _id: campaign._id },
          {
            $inc: {
              currentPromoters: -1,
              totalPromotions: -1,
            },
            $push: {
              activityLog: {
                action: "Promotion Auto-Rejected",
                details: `Promotion ${promotion._id} auto-rejected. ${scenario}.${
                  needsManualReserveReview || refundFailureReason
                    ? " Wallet reversal needs manual review."
                    : ""
                }`,
                timestamp: new Date(),
              },
            },
          },
          { session }
        );

        await session.commitTransaction();
        committed = true;
        rejected++;
      } catch (error) {
        failed++;
        await session.abortTransaction().catch(() => {});
        console.error(
          `Failed to auto-reject promotion ${promotion._id}:`,
          error
        );
      } finally {
        session.endSession();
      }

      if (!committed) {
        continue;
      }

      const notificationJobs = [
        NotificationService.createNotification({
          recipient: promoter._id,
          type: "promotion_rejected",
          title: "Promotion Expired",
          message: `Your promotion for "${campaign.title}" expired after 24 hours (${scenario}).`,
          data: { campaignId: campaign._id, promotionId: promotion._id },
          priority: "medium",
        }),
      ];

      if (refundedAmount > 0) {
        notificationJobs.push(
          NotificationService.createNotification({
            recipient: marketer._id,
            type: "refund_processed",
            title: "Funds Refunded",
            message: `N${refundedAmount} refunded for expired promotion: "${campaign.title}"`,
            data: { campaignId: campaign._id, promotionId: promotion._id },
            priority: "medium",
          })
        );
      }

      const notificationResults = await Promise.allSettled(notificationJobs);
      notificationResults.forEach((result, index) => {
        if (result.status === "rejected") {
          console.error(
            `Failed to send auto-reject notification ${index + 1} for promotion ${promotion._id}:`,
            result.reason
          );
        }
      });
    }

    const end = new Date();
    console.log(
      `Auto-reject done - rejected: ${rejected}, failed: ${failed}, duration: ${
        (end - jobStartTime) / 1000
      }s`
    );
  } catch (error) {
    console.error("Auto-reject job failed:", error);
  }
};
