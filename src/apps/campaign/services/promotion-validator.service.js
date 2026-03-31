import { PromotionModel } from "../../promotion/models/index.js";
import { CampaignModel } from "../../campaign/models/index.js";
import { UserModel } from "../../user/models/user/index.js";
import {
  moveWithinWallet,
  moveBetweenWallets
} from "../../wallet/services/wallet-move.service.js";
import { applyValidationAccounting } from "./../../notification/services/promotion-accounting.service.js";


/**
 * HANDLE PROMOTION VALIDATION
 * Routes to validate or reject
 */
export async function handlePromotionValidation({
  promotionId,
  status,
  rejectionReason,
  performedBy,
  session
}) {
  if (!session) throw new Error("Mongo session is required");
  if (!promotionId || !status) {
    throw new Error("promotionId and status are required");
  }

  if (status === "validated") {
    return validatePromotion({
      promotionId,
      adminId: performedBy,
      session
    });
  }

  if (status === "rejected") {
    return rejectPromotion({
      promotionId,
      adminId: performedBy,
      reason: rejectionReason,
      session
    });
  }

  throw new Error(`Unsupported promotion status: ${status}`);
}

/**
 * VALIDATE PROMOTION (IDEMPOTENT)
 * Rule:
 * promoter.reserved → promoter.balance
 */
export async function validatePromotion({
  promotionId,
  adminId,
  session
}) {
  if (!session) throw new Error("Mongo session is required");

  // 🔒 Atomic idempotency guard
  const promotion = await PromotionModel.findOneAndUpdate(
    {
      _id: promotionId,
      status: "submitted",
      hasReservedForPromoter: true
    },
    {
      $set: {
        status: "validated",
        validatedAt: new Date(),
        validatedBy: adminId,
        hasReservedForPromoter: false,
        hasBeenPaid: true
      }
    },
    { new: true, session }
  );

  if (!promotion) {
    throw new Error("Promotion already processed or not in a valid state");
  }

  const campaign = await CampaignModel
    .findById(promotion.campaign)
    .session(session);

  if (!campaign) {
    throw new Error("Campaign not found");
  }

  const payoutAmount = campaign.payoutPerPromotion;

  const promoterHasReserved = await UserModel.exists(
    {
      _id: promotion.promoter,
      "wallets.promoter.reserved": { $gte: payoutAmount }
    },
    { session }
  );

  if (!promoterHasReserved) {
    throw new Error("Reserved funds missing");
  }

  await applyValidationAccounting(promotion._id);

  // 💸 Wallet movement
  await moveWithinWallet({
    session,
    userId: promotion.promoter,
    side: "promoter",
    incReserved: -payoutAmount,
    incBalance: +payoutAmount
  });

  promotion.activityLog.push({
    action: "Promotion Validated",
    details: `₦${payoutAmount} paid to promoter`,
    timestamp: new Date()
  });

  await promotion.save({ session });

  return promotion;
}

/**
 * REJECT PROMOTION (IDEMPOTENT)
 */
export async function rejectPromotion({
  promotionId,
  adminId,
  reason,
  session
}) {
  if (!session) throw new Error("Mongo session is required");

  const promotion = await PromotionModel.findById(promotionId).session(session);
  if (!promotion) throw new Error("Promotion not found");

  if (promotion.status === "rejected") {
    return { success: true, promotion };
  }

  if (promotion.status === "validated") {
    throw new Error("Cannot reject a validated promotion");
  }

  if (promotion.hasBeenRefunded) {
    return { success: true, promotion };
  }

  const campaign = await CampaignModel
    .findById(promotion.campaign)
    .session(session);

  if (!campaign) throw new Error("Campaign not found");

  const payoutAmount = Number(promotion.payoutAmount);
  if (!Number.isFinite(payoutAmount) || payoutAmount <= 0) {
    throw new Error("Invalid payout amount");
  }

  // 💰 Refund logic
  await moveBetweenWallets({
    session,
    fromUserId: promotion.promoter,
    fromSide: "promoter",
    fromField: "reserved",
    toUserId: campaign.owner,
    toSide: "marketer",
    toField: "balance",
    amount: payoutAmount
  });

  promotion.status = "rejected";
  promotion.rejectedAt = new Date();
  promotion.rejectedBy = adminId;
  promotion.rejectionReason = reason;
  promotion.hasBeenRefunded = true;
  promotion.hasReservedForPromoter = false;

  campaign.currentPromoters = Math.max(0, campaign.currentPromoters - 1);
  campaign.rejectedPromotions += 1;
  campaign.reservedBudget -= payoutAmount;

  await Promise.all([
    promotion.save({ session }),
    campaign.save({ session })
  ]);

  return { success: true, promotion };
}
