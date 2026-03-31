
// src/services/wallet-move.service.js
import { UserModel } from "../..//user/models/user/index.js";

/**
 * Move funds within a single wallet side (e.g., balance -> reserved).
 * Uses guarded $inc (prevents negatives). Call inside an existing session.
 */
export async function moveWithinWallet({
  session,
  userId,
  side,               // 'marketer' | 'promoter'
  incBalance = 0,     // e.g., -payout
  incReserved = 0     // e.g., +payout
}) {
  if (!session) throw new Error("moveWithinWallet requires a MongoDB session");
  const pre = {};
  if (incBalance < 0)  pre[`wallets.${side}.balance`]  = { $gte: Math.abs(incBalance) };
  if (incReserved < 0) pre[`wallets.${side}.reserved`] = { $gte: Math.abs(incReserved) };

  const inc = {};
  if (incBalance)  inc[`wallets.${side}.balance`]  = incBalance;
  if (incReserved) inc[`wallets.${side}.reserved`] = incReserved;

  const res = await UserModel.updateOne({ _id: userId, ...pre }, { $inc: inc }, { session });
  if (!res.modifiedCount) {
    throw new Error(`Guard failed for ${side} wallet: insufficient funds for requested move.`);
  }
}

/**
 * Move funds between wallets (e.g., marketer.reserved -> promoter.reserved or promoter.reserved -> marketer.balance).
 * Performs two guarded updates in the same session/transaction.
 */
export async function moveBetweenWallets({
  session,
  fromUserId, fromSide, fromField,   // e.g., 'marketer', 'reserved'
  toUserId,   toSide,   toField,     // e.g., 'promoter', 'reserved' or 'marketer','balance'
  amount
}) {
  if (!session) throw new Error("moveBetweenWallets requires a MongoDB session");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("amount must be > 0");

  // 1) debit fromUser (guarded)
  const res1 = await UserModel.updateOne(
    { _id: fromUserId, [`wallets.${fromSide}.${fromField}`]: { $gte: amount } },
    { $inc: { [`wallets.${fromSide}.${fromField}`]: -amount },
      $push: {
        [`wallets.${fromSide}.transactions`]: {
          $each: [{
            amount: amount,
            type: "debit",
            category: "transfer",
            description: `Funds moved to ${toSide} wallet`,
            //relatedCampaign: '',
            //relatedPromotion: promotionId,
            status: "completed",
            createdAt: new Date()
          }],
          $position: 0,
          $slice: 500
        },
        // activityLog: {
        //   $each: [{
        //     action: 'promotion_downloaded',
        //     description: `You downloaded campaign materials: "${campaign.title}"`,
        //     resourceType: 'campaign',
        //     resourceId: campaignId,
        //     metadata: { campaignTitle: campaign.title, payoutAmount, downloadTime: now },
        //     timestamp: now
        //   }],
        //   $position: 0,
        //   $slice: 1000
        // }
      }
    },
    { session }
  );
  if (!res1.modifiedCount) {
    throw new Error(`Insufficient ${fromSide}.${fromField} to move ${amount}`);
  }

  // 2) credit toUser
  const res2 = await UserModel.updateOne(
    { _id: toUserId },
    { $inc: { [`wallets.${toSide}.${toField}`]: +amount } },
    { session }
  );
  if (!res2.modifiedCount) {
    throw new Error(`Failed to credit ${toSide}.${toField}`);
  }
}
