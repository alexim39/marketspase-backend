
// src/apps/campaign/services/promotion-status.service.js
import { PromotionModel } from "../../promotion/models/promotion.model.js";
import { CampaignModel }  from "../models/campaign.model.js";
import { UserModel }      from "../../user/models/user.model.js";
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

/** VALIDATE (status only) */
async function validateOnly({ promotion, performedBy, session }) {
  await PromotionModel.updateOne(
    { _id: promotion._id, status: "submitted" },
    {
      $set: { status: "validated", validatedAt: new Date(), validatedBy: performedBy },
      $push: { activityLog: { action: "Promotion Validated", details: "Validated by admin", timestamp: new Date() } }
    },
    { session }
  );
}

/** PAID (payout: promoter.reserved -> promoter.balance) */
async function payPromotion({ promotion, campaign, promoter, payoutAmount, session, operationId }) {
  // wallet move: promoter.reserved -> promoter.balance
  await moveWithinWallet({
    session,
    userId: promoter._id,
    side: 'promoter',
    incReserved: -payoutAmount,
    incBalance: +payoutAmount
  });

  // embedded promoter transaction
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

  // promotion + campaign counters
  await PromotionModel.updateOne(
    { _id: promotion._id },
    {
      $set: { status: "paid", paidAt: new Date() },
      $push: { activityLog: { action: "Promotion Paid", details: "Payment processed", timestamp: new Date() } }
    },
    { session }
  );

  await CampaignModel.updateOne(
    { _id: campaign._id },
    {
      $inc: { paidPromotions: 1, validatedPromotions: 1, reservedAmountKobo: -payoutAmount /* if you track reservedAmount */ },
      $push: { activityLog: { action: "Promoter Paid", details: `Paid ${payoutAmount} NGN`, timestamp: new Date() } }
    },
    { session }
  );
}

/** REJECT (refund scenarios) */
async function rejectPromotionFlow({
  promotion, campaign, promoter, marketer, performedBy, rejectionReason, payoutAmount, session, operationId
}) {
  // Update promotion status + activity
  await PromotionModel.updateOne(
    { _id: promotion._id },
    {
      $set: { status: "rejected", rejectionReason, validatedAt: new Date() },
      $push: { activityLog: { action: "Promotion Rejected", details: rejectionReason, timestamp: new Date() } }
    },
    { session }
  );

  if (!promotion.isDownloaded) {
    // Scenario A: accepted but NOT downloaded
    // refund marketer.reserved -> marketer.balance
    await moveWithinWallet({
      session,
      userId: marketer._id,
      side: 'marketer',
      incReserved: -payoutAmount,
      incBalance: +payoutAmount
    });

    // embedded tx on marketer
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
  } else {
    // Scenario B: downloaded but NOT submitted
    // refund promoter.reserved -> marketer.balance (two-party move)
    await moveBetweenWallets({
      session,
      fromUserId: promoter._id, fromSide: 'promoter', fromField: 'reserved',
      toUserId: marketer._id,   toSide: 'marketer',   toField: 'balance',
      amount: payoutAmount
    });

    // embedded tx on promoter
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

    // embedded tx on marketer
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

  // Free up campaign slot and possibly reactivate
  const campaignUpdate = {
    $inc: { currentPromoters: -1 },
    $push: { activityLog: { action: "Promotion Rejected", details: "Slot freed after rejection", timestamp: new Date() } }
  };
  // Optional reactivation check (same as your existing logic)
  if (campaign.status === "exhausted") {
    const remaining = (campaign.budget ?? 0) - (campaign.spentBudget ?? 0);
    if (remaining >= (campaign.payoutPerPromotion ?? payoutAmount)) {
      campaignUpdate.$set = { status: "active" };
    }
  }
  await CampaignModel.updateOne({ _id: campaign._id }, campaignUpdate, { session });
}

/** Main handler (called from controller) */
export async function handlePromotionStatusUpdate({
  promotionId, status, rejectionReason, performedBy, session, operationId
}) {
  const promotion = await PromotionModel.findById(promotionId)
    .populate({ path: 'campaign', populate: { path: 'owner', model: 'User' } })
    .populate('promoter')
    .session(session);

  if (!promotion) throw new Error("Promotion not found");
  if (promotion.status === 'rejected' || promotion.status === 'paid') {
    throw new Error(`Promotion is already ${promotion.status}.`);
  }

  const campaign = promotion.campaign;
  const promoter = promotion.promoter;
  const marketer = campaign.owner;
  const payoutAmount = Number(promotion.payoutAmount ?? campaign.payoutPerPromotion ?? 0);
  if (!Number.isFinite(payoutAmount) || payoutAmount <= 0) throw new Error("Invalid payout amount");

  switch (status) {
    case "validated":
      await validateOnly({ promotion, performedBy, session });
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

  // Return the updated promotion document
  const updated = await PromotionModel.findById(promotionId).session(session);
  return { promotion: updated };
}
