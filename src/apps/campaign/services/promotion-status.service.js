
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

/** VALIDATE (status & audit) */
async function validateOnly({ promotion, performedBy, session }) {
  const fresh = await PromotionModel.findById(promotion._id).session(session);
  if (!fresh || fresh.status === "paid" || fresh.hasBeenPaid === true) return; // already paid, do nothing

  await PromotionModel.updateOne(
    { _id: promotion._id, status: { $in: ["submitted", "pending", "validated"] } },
    {
      $set: { status: "validated", validatedAt: new Date(), validatedBy: performedBy },
      $push: { activityLog: { action: "Promotion Validated", details: "Validated by admin", timestamp: new Date() } }
    },
    { session }
  );
}


/** PAY (payout: promoter.reserved -> promoter.balance) */
async function payPromotion({ promotion, campaign, promoter, payoutAmount, session, operationId }) {
  // Idempotency: if already paid, skip
  const fresh = await PromotionModel.findById(promotion._id).session(session);
  if (fresh?.status === "paid") return;

  // Must have reserved funds on promoter side before paying
  // (download step should have set hasReservedForPromoter and moved marketer.reserved -> promoter.reserved)
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

  // Promotion -> paid (also keep audit entries)
  await PromotionModel.updateOne(
    { _id: promotion._id },
    {
      $set: { 
        status: "paid", paidAt: new Date(),
        hasBeenPaid: true, 
      },
      $push: { activityLog: { action: "Promotion Paid", details: "Payment processed", timestamp: new Date() } }
    },
    { session }
  );

  // Campaign counters: increment paid & validated; decrease reservedAmount (use your existing `reservedAmount` field)
  await CampaignModel.updateOne(
    { _id: campaign._id },
    {
      $inc: {
        paidPromotions: 1,
        validatedPromotions: 1,
        totalPromotions: 1,      // <-- Increment totalPromotions on payment
        reservedAmount: -payoutAmount // <-- match your model/controller that uses `reservedAmount`
      },
      $push: { activityLog: { action: "Promoter Paid", details: `Paid ${payoutAmount} NGN`, timestamp: new Date() } }
    },
    { session }
  );

  
  // Trigger pre-save hook to recalculate spentBudget
  const updatedCampaign = await CampaignModel.findById(campaign._id).session(session);
  if (updatedCampaign) await updatedCampaign.save({ session });

}

/** REJECT (refund scenarios) */
async function rejectPromotionFlow({
  promotion, campaign, promoter, marketer, performedBy, rejectionReason, payoutAmount, session, operationId
}) {

  
 // Refresh latest flags inside the session for accurate branching
  const fresh = await PromotionModel.findById(promotion._id).session(session);
  if (!fresh) throw new Error("Promotion not found for rejection");

  // Idempotency: if already rejected and refunded, skip
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
    { session }
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

    
    // Flags: reservation at marketer side is now released
    await PromotionModel.updateOne(
      { _id: promotion._id },
      {
        $set: {
          hasBeenRefunded: true,           // <-- ✅ flip refund flag
        }
      },
      { session }
    );

  } else {
    // Scenario B: downloaded but NOT submitted -> refund promoter.reserved -> marketer.balance
    await moveBetweenWallets({
      session,
      fromUserId: promoter._id, fromSide: 'promoter', fromField: 'reserved',
      toUserId: marketer._id,   toSide: 'marketer',  toField: 'balance',
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

  // Free up campaign slot and possibly reactivate
  const campaignUpdate = {
    $inc: { 
      currentPromoters: -1,
      totalPromotions: -1
    },
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

  const campaign  = promotion.campaign;
  const promoter  = promotion.promoter;
  const marketer  = campaign.owner;
  const payoutAmount = Number(promotion.payoutAmount ?? campaign.payoutPerPromotion ?? 0);
  if (!Number.isFinite(payoutAmount) || payoutAmount <= 0) throw new Error("Invalid payout amount");

  switch (status) {
    case "validated":
      // NEW: validate AND pay in the same flow
      await validateOnly({ promotion, performedBy, session });
      await payPromotion({ promotion, campaign, promoter, payoutAmount, session, operationId });
      break;

    case "paid":
      // Direct pay (kept for backward compatibility)
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
