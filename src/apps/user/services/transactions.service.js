
// src/apps/transactions/services/transactions.service.js
import { UserModel } from "../../user/models/user.model.js";

/**
 * Record a reservation transaction INSIDE the marketer's embedded transactions array
 * (wallets.marketer.transactions) using your existing transaction.schema.js.
 *
 * NOTE on amounts:
 * - Your embedded transaction schema uses `amount: Number` (NGN or minor units).
 * - If you've migrated to minor units (kobo), pass `amountKobo` and store it in `amount`.
 * - Otherwise pass `amountNaira` consistently.
 *
 * @param {Object} params
 * @param {import('mongoose').ClientSession} params.session
 * @param {string} params.marketerId
 * @param {string} params.campaignId
 * @param {string} params.promotionId
 * @param {number} params.amount            // integer minor units (preferred) or NGN float (legacy)
 * @param {string} [params.operationId]     // optional; used in description for simple idempotency tracking
 */
export async function recordReservationTxEmbedded({
  session,
  marketerId,
  campaignId,
  promotionId,
  amount,
  operationId = `reserve:${promotionId}`
}) {
  if (!session) throw new Error("recordReservationTxEmbedded requires a MongoDB session");
  if (!marketerId || !campaignId || !promotionId) throw new Error("marketerId, campaignId, promotionId are required");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("amount must be a positive number");

  // 🔒 Idempotency guard: skip if a 'reserved' tx for this promotion already exists
  const marketer = await UserModel.findOne({
    _id: marketerId,
    "wallets.marketer.transactions": {
      $elemMatch: {
        relatedPromotion: promotionId,
        status: "reserved",                 // matches your transaction.status enum
        category: "campaign"
      }
    }
  }).select("_id").session(session);

  if (marketer) {
    // Already recorded; nothing to do
    return { ok: true, skipped: true };
  }

  // ✅ Append embedded transaction atomically (use $push)
  const description = `Funds reserved for campaign acceptance (op:${operationId})`;

  const res = await UserModel.updateOne(
    { _id: marketerId },
    {
      $push: {
        "wallets.marketer.transactions": {
          _id: undefined,              // allow your pre-save hook to set ObjectId when present
          amount: amount,              // prefer minor units (kobo) if you've migrated
          amountPayable: 0,
          type: "debit",               // 👈 enum: ['credit','debit','system_correction']
          category: "campaign",        // 👈 must be in your enum (valid)
          description,
          relatedCampaign: campaignId,
          relatedPromotion: promotionId,
          status: "reserved",          // 👈 enum: includes 'reserved'
          createdAt: new Date()
        }
      }
    },
    { session }
  );

  if (!res.modifiedCount) {
    throw new Error("Failed to append reservation transaction to marketer wallet");
  }

  return { ok: true, skipped: false };
}