
// src/apps/campaign/services/promotion-status.service.js
import { PromotionModel } from "../../promotion/models/promotion.model.js";
import { CampaignModel } from "../models/campaign.model.js";
import { UserModel } from "../../user/models/user.model.js";
import { moveWithinWallet, moveBetweenWallets } from "../../wallet/services/wallet-move.service.js";

/** Helper: append an embedded transaction line safely */
async function pushEmbeddedTx({ session, userId, path, entry }) {
  const res = await UserModel.updateOne(
    { _id: userId },
    { $push: { [path]: entry } },
    { session }
  );
  if (!res.modifiedCount) throw new Error(`Failed to append transaction to ${path}`);
}

/** VALIDATE (status & audit) — promotion-only */
async function validateOnly({ promotion, performedBy, session }) {
  // Read as plain object to avoid hydration/casting
  const fresh = await PromotionModel.findById(promotion._id).lean().session(session);
  if (!fresh || fresh.status === "paid" || fresh.hasBeenPaid === true) return; // already paid, skip

  await PromotionModel.updateOne(
    { _id: promotion._id, status: { $in: ["submitted", "pending", "validated"] } },
    {
      $set: { status: "validated", validatedAt: new Date(), validatedBy: performedBy },
      $push: { activityLog: { action: "Promotion Validated", details: "Validated by admin", timestamp: new Date() } }
    },
    { session, runValidators: true }
  );
}

/** PAY (payout: promoter.reserved -> promoter.balance) — no Campaign hydration */
async function payPromotion({ promotion, campaign, promoter, payoutAmount, session, operationId }) {
  // Idempotency (read lean)
  const fresh = await PromotionModel.findById(promotion._id).lean().session(session);
  if (fresh?.status === "paid") return;

  if (!fresh?.hasReservedForPromoter) {
    throw new Error("Cannot pay: promotion funds were not reserved for the promoter.");
  }

  // Wallet move: promoter.reserved -> promoter.balance
  await moveWithinWallet({
    session,
    userId: promoter._id,
    side: 'promoter',
    incReserved: -payoutAmount,
    incBalance: +payoutAmount
  });

  // Embedded promoter transaction
  await pushEmbeddedTx({
    session,
    userId: promoter._id,
    path: "wallets.promoter.transactions",
    entry: {
      amount: payoutAmount,
      type: "credit",
      category: "promotion",
      description: `Payment for validated promotion: "${campaign.title}" (op:${operationId})`,
      relatedCampaign: campaign._id,
      relatedPromotion: promotion._id,
      status: "successful",
      createdAt: new Date()
    }
  });

  // Promotion -> paid
  await PromotionModel.updateOne(
    { _id: promotion._id },
    {
      $set: { status: "paid", paidAt: new Date(), hasBeenPaid: true },
      $push: { activityLog: { action: "Promotion Paid", details: "Payment processed", timestamp: new Date() } }
    },
    { session, runValidators: true }
  );

  /**
   * Campaign counters: update atomically and recompute spentBudget/exhausted status
   * IMPORTANT: We DO NOT load the Campaign as a hydrated document and DO NOT touch ageTarget.
   */
  // Get minimal fields needed (lean)
  const c = await CampaignModel.findById(campaign._id, {
    payoutPerPromotion: 1,
    budget: 1,
    paidPromotions: 1,
    spentBudget: 1,
    status: 1,
    title: 1
  }).lean().session(session);

  if (!c) throw new Error("Campaign not found during payment");

  // Compute new counters in memory (plain values)
  const newPaidPromotions = (c.paidPromotions ?? 0) + 1;
  const newSpentBudget = (newPaidPromotions * (c.payoutPerPromotion ?? 0));
  const isExhausted = newSpentBudget >= (c.budget ?? 0);

  // Apply atomic update — never includes ageTarget
  await CampaignModel.updateOne(
    { _id: campaign._id },
    {
      $inc: { paidPromotions: 1, validatedPromotions: 1, totalPromotions: 1, reservedAmount: -payoutAmount },
      $set: { spentBudget: newSpentBudget, ...(isExhausted ? { status: "exhausted" } : {}) },
      $push: { activityLog: { action: "Promoter Paid", details: `Paid ${payoutAmount} NGN`, timestamp: new Date() } }
    },
    { session, runValidators: true }
  );
}

/** REJECT (refund scenarios) — avoids Campaign hydration and ageTarget */
async function rejectPromotionFlow({
  promotion, campaign, promoter, marketer, performedBy, rejectionReason, payoutAmount, session, operationId
}) {
  // Fresh promotion (lean)
  const fresh = await PromotionModel.findById(promotion._id).lean().session(session);
  if (!fresh) throw new Error("Promotion not found for rejection");

  if (fresh.status === "rejected" && fresh.hasBeenRefunded === true) {
    return;
  }

  // Update promotion status + activity
  await PromotionModel.updateOne(
    { _id: promotion._id },
    {
      $set: { status: "rejected", rejectionReason, validatedAt: new Date() },
      $push: { activityLog: { action: "Promotion Rejected", details: rejectionReason, timestamp: new Date() } }
    },
    { session, runValidators: true }
  );

  if (!promotion.isDownloaded) {
    // Scenario A: accepted but NOT downloaded -> refund marketer.reserved -> marketer.balance
    await moveWithinWallet({
      session,
      userId: marketer._id,
      side: 'marketer',
      incReserved: -payoutAmount,
      incBalance: +payoutAmount
    });

    await pushEmbeddedTx({
      session,
      userId: marketer._id,
      path: "wallets.marketer.transactions",
      entry: {
        amount: payoutAmount,
        type: "credit",
        category: "refund",
        description: `Refund for unclaimed promotion: "${campaign.title}" (op:${operationId})`,
        relatedCampaign: campaign._id,
        relatedPromotion: promotion._id,
        status: "successful",
        createdAt: new Date()
      }
    });

    await PromotionModel.updateOne(
      { _id: promotion._id },
      { $set: { hasBeenRefunded: true } },
      { session, runValidators: true }
    );
  } else {
    // Scenario B: downloaded but NOT submitted -> refund promoter.reserved -> marketer.balance
    await moveBetweenWallets({
      session,
      fromUserId: promoter._id, fromSide: 'promoter', fromField: 'reserved',
      toUserId: marketer._id, toSide: 'marketer', toField: 'balance',
      amount: payoutAmount
    });

    await pushEmbeddedTx({
      session,
      userId: promoter._id,
      path: "wallets.promoter.transactions",
      entry: {
        amount: payoutAmount,
        type: "debit",
        category: "refund",
        description: `Reserved funds released for expired/rejected promotion: "${campaign.title}" (op:${operationId})`,
        relatedCampaign: campaign._id,
        relatedPromotion: promotion._id,
        status: "reversed",
        createdAt: new Date()
      }
    });

    await pushEmbeddedTx({
      session,
      userId: marketer._id,
      path: "wallets.marketer.transactions",
      entry: {
        amount: payoutAmount,
        type: "credit",
        category: "refund",
        description: `Refund received for expired/rejected promotion: "${campaign.title}" (op:${operationId})`,
        relatedCampaign: campaign._id,
        relatedPromotion: promotion._id,
        status: "successful",
        createdAt: new Date()
      }
    });
  }

  // Free up campaign slot and possibly reactivate — read minimal fields lean
  const c = await CampaignModel.findById(campaign._id, {
    budget: 1, spentBudget: 1, payoutPerPromotion: 1, status: 1
  }).lean().session(session);

  const campaignUpdate = {
    $inc: { currentPromoters: -1, totalPromotions: -1 },
    $push: { activityLog: { action: "Promotion Rejected", details: "Slot freed after rejection", timestamp: new Date() } }
  };

  if (c?.status === "exhausted") {
    const remaining = (c.budget ?? 0) - (c.spentBudget ?? 0);
    if (remaining >= (c.payoutPerPromotion ?? payoutAmount)) {
      campaignUpdate.$set = { status: "active" };
    }
  }

  await CampaignModel.updateOne({ _id: campaign._id }, campaignUpdate, { session, runValidators: true });
}

/** Main handler (called from controller) — no Campaign hydration anywhere */
export async function handlePromotionStatusUpdate({
  promotionId, status, rejectionReason, performedBy, session, operationId
}) {
  // Load promotion with the necessary relations; keep campaign/promoter lean objects
  const promotion = await PromotionModel.findById(promotionId)
    .populate({ path: 'campaign', select: 'title payoutPerPromotion budget paidPromotions spentBudget status owner', populate: { path: 'owner', model: 'User', select: '_id' } })
    .populate('promoter', '_id')
    .lean()
    .session(session);

  if (!promotion) throw new Error("Promotion not found");
  if (promotion.status === 'rejected' || promotion.status === 'paid') {
    throw new Error(`Promotion is already ${promotion.status}.`);
  }

  // Extract minimal fields from lean promotion
  const campaign = promotion.campaign;     // plain object (no hydration, no casting)
  const promoter = promotion.promoter;
  const marketer = campaign?.owner;

  const payoutAmount = Number(promotion.payoutAmount ?? campaign?.payoutPerPromotion ?? 0);
  if (!Number.isFinite(payoutAmount) || payoutAmount <= 0) throw new Error("Invalid payout amount");

  switch (status) {
    case "validated":
      await validateOnly({ promotion, performedBy, session });
      await payPromotion({ promotion, campaign, promoter, payoutAmount, session, operationId });
      break;

    case "paid":
      await payPromotion({ promotion, campaign, promoter, payoutAmount, session, operationId });
      break;

    case "rejected":
      await rejectPromotionFlow({
        promotion, campaign, promoter, marketer,
        performedBy, rejectionReason, payoutAmount, session, operationId
      });
      break;

    default:
      throw new Error(`Invalid status update: ${status}`);
  }

  // Return updated promotion (lean)
  const updated = await PromotionModel.findById(promotionId).lean().session(session);
  return { promotion: updated };
}
