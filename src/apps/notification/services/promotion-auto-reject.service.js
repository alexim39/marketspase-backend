import { CampaignModel } from './../../campaign/models/campaign.model.js';
import mongoose from 'mongoose';
import { PromotionModel } from './../../promotion/models/promotion.model.js';
import { UserModel } from './../../user/models/user.model.js';
import { NotificationService } from './notification.service.js';

export const promotionAutoRejection = async () => {
  const jobStartTime = new Date();
  console.log(`🕐 [${jobStartTime.toISOString()}] Auto-Reject expired promotions started`);

  try {
    const threshold = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Find expired unsubmitted promotions
    const expiredPromotions = await PromotionModel.find({
      status: "pending",
      createdAt: { $lte: threshold }
    })
      .populate("promoter", "displayName email wallets")
      .populate({
        path: "campaign",
        populate: { path: "owner", model: "User", select: "displayName email wallets" }
      });

    console.log(`📊 Found ${expiredPromotions.length} expired promotions`);

    let rejected = 0;
    let failed = 0;

    for (const promotion of expiredPromotions) {
      // SKIP if already refunded/paid
      if (promotion.hasBeenPaid || promotion.hasBeenRefunded) continue;

      const promoter = promotion.promoter;
      const campaign = promotion.campaign;
      const marketer = campaign.owner;
      const payoutAmount = promotion.payoutAmount || campaign.payoutPerPromotion;

      const SCENARIO =
        promotion.isDownloaded === true
          ? "Downloaded but NOT submitted"
          : "Accepted but NOT downloaded";

      const session = await mongoose.startSession();

      try {
        await session.startTransaction();

        // 1️⃣ Mark promotion rejected
        await PromotionModel.findByIdAndUpdate(
          promotion._id,
          {
            $set: {
              status: "rejected",
              rejectedAt: new Date(),
              rejectionReason: `Promotion expired — ${SCENARIO}`,
              hasBeenRefunded: true
            },
            $push: {
              activityLog: {
                action: "Auto-Rejected",
                details: `Promotion automatically rejected after 24 hours. ${SCENARIO}.`,
                timestamp: new Date()
              }
            }
          },
          { session }
        );

        // 2️⃣ FINANCIAL LOGIC — Based on scenario

        if (!promotion.isDownloaded) {
          // Scenario A: accepted but NEVER downloaded
          // Refund: marketer.reserved → marketer.balance

          if (promotion.hasReservedFromMarketer === true) {
            await UserModel.findByIdAndUpdate(
              marketer._id,
              {
                $inc: {
                  "wallets.marketer.reserved": -payoutAmount,
                  "wallets.marketer.balance": payoutAmount
                },
                $push: {
                  "wallets.marketer.transactions": {
                    amount: payoutAmount,
                    type: "credit",
                    category: "refund",
                    description: `Refund for unclaimed promotion: ${campaign.title}`,
                    relatedCampaign: campaign._id,
                    relatedPromotion: promotion._id,
                    status: "successful",
                    timestamp: new Date()
                  }
                }
              },
              { session }
            );
          }

        } else {
          // Scenario B: downloaded but NOT submitted
          // Refund: promoter.reserved → marketer.balance

          if (promotion.hasReservedForPromoter === true) {
            // Remove from promoter escrow
            await UserModel.findByIdAndUpdate(
              promoter._id,
              {
                $inc: { "wallets.promoter.reserved": -payoutAmount },
                $push: {
                  "wallets.promoter.transactions": {
                    amount: payoutAmount,
                    type: "debit",
                    category: "refund",
                    description: `Reserved funds released for expired promotion: ${campaign.title}`,
                    relatedCampaign: campaign._id,
                    relatedPromotion: promotion._id,
                    status: "reversed",
                    timestamp: new Date()
                  }
                }
              },
              { session }
            );

            // Credit marketer balance
            await UserModel.findByIdAndUpdate(
              marketer._id,
              {
                $inc: { "wallets.marketer.balance": payoutAmount },
                $push: {
                  "wallets.marketer.transactions": {
                    amount: payoutAmount,
                    type: "credit",
                    category: "refund",
                    description: `Refund received for expired promotion: ${promotion.upi || promotion._id}`,
                    relatedCampaign: campaign._id,
                    relatedPromotion: promotion._id,
                    status: "successful",
                    timestamp: new Date()
                  }
                }
              },
              { session }
            );
          }
        }

        // 3️⃣ UPDATE CAMPAIGN (NO budget manipulation here)
        const campaignUpdate = {
          $inc: { currentPromoters: -1 },
          $push: {
            activityLog: {
              action: "Promotion Auto-Rejected",
              details: `Promotion ${promotion._id} auto-rejected. ${SCENARIO}.`,
              timestamp: new Date()
            }
          }
        };

        // Reactivate campaign if it was exhausted and budget allows
        if (campaign.status === "exhausted") {
          const remaining = campaign.budget - campaign.spentBudget;
          if (remaining >= campaign.payoutPerPromotion) {
            campaignUpdate.$set = { status: "active" };
          }
        }

        await CampaignModel.findByIdAndUpdate(campaign._id, campaignUpdate, { session });

        await session.commitTransaction();
        rejected++;
      } catch (err) {
        failed++;
        await session.abortTransaction().catch(() => {});
        console.error(`Failed to auto-reject promotion ${promotion._id}:`, err);
      } finally {
        session.endSession();
      }

      // 4️⃣ OUTSIDE TRANSACTION → Notifications
      await NotificationService.createNotification({
        recipient: promoter._id,
        type: "promotion_rejected",
        title: "Promotion Expired ⏰",
        message: `Your promotion for "${campaign.title}" expired after 24 hours (${SCENARIO}).`,
        data: {
          campaignId: campaign._id,
          promotionId: promotion._id,
          scenario: SCENARIO
        },
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
    console.log(
      `🎉 Auto-Reject job DONE — rejected: ${rejected}, failed: ${failed}, duration: ${
        (end - jobStartTime) / 1000
      }s`
    );
  } catch (err) {
    console.error("❌ Auto-Reject job failed:", err);
  }
}