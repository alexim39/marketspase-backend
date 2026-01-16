
// src/apps/promotion/services/promotion-accounting.service.js
import mongoose from "mongoose";
import { PromotionModel } from "../../promotion/models/promotion.model.js";
import { CampaignModel } from "../../campaign/models/campaign.model.js";

/**
 * Idempotent accounting updates for campaign counters whenever a promotion
 * transitions to `validated` or `paid`.
 *
 * -> Call after you set a promotion's status to "validated" or "paid".
 * -> Uses flags on the promotion to avoid double-counting under retries/concurrency.
 *    Add two small flags: accounting.validatedCounted, accounting.paidCounted.
 */

// Optional: extend Promotion schema once with these flags (see note below):
// accounting: { validatedCounted: {type:Boolean, default:false}, paidCounted: {type:Boolean, default:false} }

export async function applyValidationAccounting(promotionId) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const promo = await PromotionModel.findById(promotionId).session(session);
      if (!promo) return;

      // Only for truly validated, and only once
      if (promo.status !== "validated") return;
      if (promo.accounting?.validatedCounted) return;

      const campaignId = promo.campaign;
      // Increment validatedPromotions by 1
      const { modifiedCount } = await CampaignModel.updateOne(
        { _id: campaignId },
        {
          $inc: { validatedPromotions: 1 },
          $push: {
            activityLog: {
              action: "Promotion Validated (accounting)",
              details: `Promo ${promo._id} counted`,
              timestamp: new Date()
            }
          }
        }
      ).session(session);

      if (modifiedCount) {
        // Mark counted so we never do it twice
        await PromotionModel.updateOne(
          { _id: promo._id, "accounting.validatedCounted": { $ne: true } },
          { $set: { "accounting.validatedCounted": true } }
        ).session(session);
      }
    }, { writeConcern: { w: "majority" } });
  } finally {
    await session.endSession();
  }
}

export async function applyPaymentAccounting(promotionId) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const promo = await PromotionModel.findById(promotionId).session(session);
      if (!promo) return;

      // Only for truly paid, and only once
      if (promo.status !== "paid" || !promo.hasBeenPaid) return;
      if (promo.accounting?.paidCounted) return;

      const campaign = await CampaignModel.findById(promo.campaign).session(session);
      if (!campaign) return;

      // Decide payout amount: prefer per-promotion amount from promo; fallback to campaign tier
      const amount = Number(promo.payoutAmount ?? campaign.payoutPerPromotion) || 0;

      const { modifiedCount } = await CampaignModel.updateOne(
        { _id: campaign._id },
        {
          $inc: {
            paidPromotions: 1,
            spentBudget: amount,   // actual spend
            totalPayouts: amount   // total disbursed to promoters
          },
          $push: {
            activityLog: {
              action: "Promotion Paid (accounting)",
              details: `Promo ${promo._id} paid NGN ${amount}`,
              timestamp: new Date()
            }
          }
        }
      ).session(session);

      if (modifiedCount) {
        await PromotionModel.updateOne(
          { _id: promo._id, "accounting.paidCounted": { $ne: true } },
          { $set: { "accounting.paidCounted": true } }
        ).session(session);
      }
    }, { writeConcern: { w: "majority" } });
  } finally {
    await session.endSession();
  }
}
