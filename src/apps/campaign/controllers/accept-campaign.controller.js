// apps/campaign/controllers/accept-campaign.controller.js
import mongoose from "mongoose";
import { CampaignModel } from "../models/campaign.model.js";
import { PromotionModel } from "../../promotion/models/promotion.model.js";
import { UserModel } from "../../user/models/user/index.js";
import { logUserActivity } from "../../user/services/activity.service.js";

const MAX_TX_RETRIES = 5;
// Make this env-configurable if you like; default to 3
const MAX_ACCEPTS_PER_CAMPAIGN_PER_USER = Number(process.env.MAX_ACCEPTS_PER_CAMPAIGN_PER_USER ?? 3);

const isRetryableTxnError = (err) =>
  err?.errorLabels?.includes("TransientTransactionError") ||
  err?.errorLabels?.includes("UnknownTransactionCommitResult") ||
  /Write conflict/i.test(err?.message ?? "");

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export const acceptCampaign = async (req, res) => {
  
  let lastErr;
  for (let attempt = 1; attempt <= MAX_TX_RETRIES; attempt++) {
    const session = await mongoose.startSession();
    try {
      const promotion = await session.withTransaction(async () => {
        const { campaignId } = req.params;
        const { userId } = req.body;

        //console.log('campaignId ',campaignId)
        //console.log('userId ',userId)

        /* 1️⃣ Load campaign */
        const campaign = await CampaignModel.findById(campaignId)
          .session(session)
          .select(`
            _id title owner status
            payoutTierId payoutPerPromotion
            minViewsPerPromotion maxViewsPerPromotion
            maxPromoters currentPromoters
          `);
        if (!campaign) throw { status: 404, message: "Campaign not found" };
        if (campaign.status !== "active")
          throw { status: 400, message: "Campaign is not active" };
        if (campaign.currentPromoters >= campaign.maxPromoters)
          throw { status: 400, message: "Campaign has reached promoter limit" };

        //console.log('campaign ',campaign)

        /* 2️⃣ Load promoter */
        const promoter = await UserModel.findById(userId)
          .session(session)
          .select("_id role");
        if (!promoter || promoter.role !== "promoter")
          throw { status: 403, message: "Only promoters can accept campaigns" };

        //console.log('promoter ',promoter)

        /* 3️⃣ Idempotency check (block if an active accept already exists for this campaign) */
        const existingPromotion = await PromotionModel.findOne({
          campaign: campaign._id,
          promoter: promoter._id,
          status: { $in: ["accepted", "submitted", "downloaded"] },
        }).session(session);
        if (existingPromotion)
          throw { status: 409, message: "Campaign already accepted" }; // keeps existing behavior

        //console.log('existingPromotion ',existingPromotion)

        /* 3️⃣.a Lifetime cap: prevent >3 accepts for the same campaign by the same promoter */
        const lifetimeCount = await PromotionModel.countDocuments({
          campaign: campaign._id,
          promoter: promoter._id,
          // Count ALL statuses to enforce a true lifetime cap
        }).session(session);
        if (lifetimeCount >= MAX_ACCEPTS_PER_CAMPAIGN_PER_USER) {
          throw {
            status: 403,
            message: `Limit reached: you can only accept this campaign ${MAX_ACCEPTS_PER_CAMPAIGN_PER_USER} times`,
          };
        }
        // (This is inside the same transaction, so concurrent requests won't slip through) 


        /* 4️⃣ Load marketer + reserve funds */
        const marketer = await UserModel.findById(campaign.owner)
          .session(session)
          .select("wallets.marketer");

          //console.log('marketer ',marketer)

        const payout = Number(campaign.payoutPerPromotion);
        if (!Number.isFinite(payout) || payout <= 0) {
          throw {
            status: 500,
            message: "Invalid campaign payout configuration",
          };
        }
        if (marketer.wallets.marketer.balance < payout)
          throw { status: 400, message: "Campaign budget exhausted" };

        marketer.wallets.marketer.balance = Number(marketer.wallets.marketer.balance ?? 0) - payout;
        marketer.wallets.marketer.reserved = Number(marketer.wallets.marketer.reserved ?? 0) + payout;
        marketer.wallets.marketer.transactions.push({
          type: "debit",
          category: "reserved_credit",
          amount: Number(payout),
          currency: "NGN",
          description: `Reserved payout for campaign "${campaign.title}"`,
          createdAt: new Date(),
        });
        await marketer.save({ session });

        /* 5️⃣ Create promotion with locked payout snapshot */
        const promotion = await new PromotionModel({
          campaign: campaign._id,
          promoter: promoter._id,
          status: "accepted",
          acceptedAt: new Date(),
          payoutAmount: payout,
          payoutSnapshot: {
            model: "range_based",
            tierId: campaign.payoutTierId,
            payoutAmount: payout,
            minViews: campaign.minViewsPerPromotion,
            maxViews: campaign.maxViewsPerPromotion,
            lockedAt: new Date(),
          },
          viewsAchieved: 0,
          isDownloaded: false,
          hasReservedFromMarketer: true,
          hasBeenPaid: false,
        }).save({ session });

        /* 6️⃣ Increment campaign counter */
        await CampaignModel.updateOne(
          { _id: campaign._id },
          { $inc: { currentPromoters: 1 } },
          { session }
        );

        /* 7️⃣ Activity log */
        await logUserActivity({
          session,
          userId: promoter._id,
          action: "campaign_accept",
          description: `Accepted campaign "${campaign.title}"`,
          resourceType: "campaign",
          resourceId: campaign._id,
          metadata: {
            promotionId: promotion._id,
            payout,
            minViews: campaign.minViewsPerPromotion,
            maxViews: campaign.maxViewsPerPromotion,
          },
        });

        return promotion;
      },
      {
        maxCommitTimeMS: 8000,      // cap commit time
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" }
      }
      );

      session.endSession();

       // do NOT await
      setImmediate(() => {
        UserModel.updateOne(
          { _id: req.body.userId },
          { $set: { lastSeenAt: new Date() } }
        ).catch(err => console.error("lastSeenAt update failed:", err.message));
      });

      return res.json({
        success: true,
        message: "Campaign accepted successfully",
        promotion,
      });

    } catch (err) {
      session.endSession();
      if (isRetryableTxnError(err) && attempt < MAX_TX_RETRIES) {
        await delay(50 * 2 ** attempt);
        lastErr = err;
        continue;
      }
      return res.status(err?.status ?? 500).json({
        success: false,
        message: err?.message ?? "Failed to accept campaign",
      });
    }
  }

  return res.status(503).json({
    success: false,
    message: "System busy. Please retry.",
  });
};



/* 
import mongoose from "mongoose";
import { CampaignModel } from "../models/campaign.model.js";
import { PromotionModel } from "../../promotion/models/promotion.model.js";
import { UserModel } from "../../user/models/user.model.js";
import { logUserActivity } from "../../user/services/activity.service.js";

const MAX_TX_RETRIES = 5;

const isRetryableTxnError = (err) =>
  err?.errorLabels?.includes("TransientTransactionError") ||
  err?.errorLabels?.includes("UnknownTransactionCommitResult") ||
  /Write conflict/i.test(err?.message || "");

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export const acceptCampaign = async (req, res) => {
  let lastErr;

  for (let attempt = 1; attempt <= MAX_TX_RETRIES; attempt++) {
    const session = await mongoose.startSession();

    try {
      const promotion = await session.withTransaction(async () => {
        const { campaignId } = req.params;
        const { userId } = req.body;

        // 1️⃣ Load campaign 
        const campaign = await CampaignModel.findById(campaignId)
          .session(session)
          .select(`
            _id title owner status
            payoutTierId payoutPerPromotion
            minViewsPerPromotion maxViewsPerPromotion
            maxPromoters currentPromoters
          `);

        if (!campaign) throw { status: 404, message: "Campaign not found" };
        if (campaign.status !== "active")
          throw { status: 400, message: "Campaign is not active" };
        if (campaign.currentPromoters >= campaign.maxPromoters)
          throw { status: 400, message: "Campaign has reached promoter limit" };

        // 2️⃣ Load promoter
        const promoter = await UserModel.findById(userId)
          .session(session)
          .select("_id role");

        if (!promoter || promoter.role !== "promoter")
          throw { status: 403, message: "Only promoters can accept campaigns" };

        // 3️⃣ Idempotency check 
        const existingPromotion = await PromotionModel.findOne({
          campaign: campaign._id,
          promoter: promoter._id,
          status: { $in: ["accepted", "submitted", "downloaded"] }
        }).session(session);

        if (existingPromotion)
          throw { status: 409, message: "Campaign already accepted" };

        // 4️⃣ Load marketer + reserve funds 
        const marketer = await UserModel.findById(campaign.owner)
          .session(session)
          .select("wallets.marketer");

        const payout = Number(campaign.payoutPerPromotion);

        if (!Number.isFinite(payout) || payout <= 0) {
          throw {
            status: 500,
            message: "Invalid campaign payout configuration"
          };
        }

        if (marketer.wallets.marketer.balance < payout)
          throw { status: 400, message: "Campaign budget exhausted" };

        marketer.wallets.marketer.balance = Number(marketer.wallets.marketer.balance || 0) - payout;

        marketer.wallets.marketer.reserved = Number(marketer.wallets.marketer.reserved || 0) + payout;

        marketer.wallets.marketer.transactions.push({
          type: "debit",
          category: "reserved_credit",
          amount: Number(payout),
          currency: "NGN",
          description: `Reserved payout for campaign "${campaign.title}"`,
          createdAt: new Date()
        });

        await marketer.save({ session });

        //5️⃣ Create promotion with locked payout snapshot 
        const promotion = await new PromotionModel({
          campaign: campaign._id,
          promoter: promoter._id,
          status: "accepted",
          acceptedAt: new Date(),
          payoutAmount: payout,
          payoutSnapshot: {
            model: "range_based",
            tierId: campaign.payoutTierId,
            payoutAmount: payout,
            minViews: campaign.minViewsPerPromotion,
            maxViews: campaign.maxViewsPerPromotion,
            lockedAt: new Date()
          },
          viewsAchieved: 0,
          isDownloaded: false,
          hasReservedFromMarketer: true,
          hasBeenPaid: false
        }).save({ session });

        //6️⃣ Increment campaign counter
        await CampaignModel.updateOne(
          { _id: campaign._id },
          { $inc: { currentPromoters: 1 } },
          { session }
        );

        // 7️⃣ Activity log 
        await logUserActivity({
          session,
          userId: promoter._id,
          action: "campaign_accept",
          description: `Accepted campaign "${campaign.title}"`,
          resourceType: "campaign",
          resourceId: campaign._id,
          metadata: {
            promotionId: promotion._id,
            payout,
            minViews: campaign.minViewsPerPromotion,
            maxViews: campaign.maxViewsPerPromotion
          }
        });

        return promotion;
      });

      session.endSession();

      return res.json({
        success: true,
        message: "Campaign accepted successfully",
        promotion
      });

    } catch (err) {
      session.endSession();
      lastErr = err;

      if (isRetryableTxnError(err) && attempt < MAX_TX_RETRIES) {
        await delay(50 * 2 ** attempt);
        continue;
      }

      return res.status(err?.status || 500).json({
        success: false,
        message: err?.message || "Failed to accept campaign"
      });
    }
  }

  return res.status(503).json({
    success: false,
    message: "System busy. Please retry."
  });
};
 */