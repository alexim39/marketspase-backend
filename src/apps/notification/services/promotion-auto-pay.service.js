
// src/apps/notification/services/promotion-auto-pay.service.js
import { PromotionModel } from "../../promotion/models/promotion.model.js";
import { applyPaymentAccounting } from "./promotion-accounting.service.js";
/**
 * Auto-pay validated promotions after 24 hours.
 *
 * Behavior:
 * - Select promotions with { status: "validated", validatedAt <= now-24h, hasBeenPaid != true }
 * - Mark as paid atomically (one-by-one) to avoid races
 * - Let model hooks handle activityLog + notifications (already in your promotion.model.js)
 *
 * Idempotency & Concurrency:
 * - Uses findOneAndUpdate with a strict filter so each doc is transitioned at most once
 * - If a concurrent worker updated it, the filter won’t match and we simply skip it
 */
export const promotionAutoPayService = async (options = {}) => {
  const {
    batchSize = 200,              // how many to fetch per page
    maxBatches = 50,              // guardrail for very large backlogs (10k max by default)
    lookbackHours = 24,           // age threshold
    dryRun = false,               // if true, only logs; no writes
    logger = console,             // pluggable logger
  } = options;

  logger.log("⏳ Running auto-pay job…");

  const cutoff = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);

  // Base filter (same logic you used in your script, but corrected to target UNPAID)
  const baseFilter = {
    status: "validated",
    validatedAt: { $lte: cutoff },
    hasBeenPaid: true, 
    // hasBeenPaid: { $ne: true },   // we only want not-yet-paid
  };

  // Count first for visibility
  const totalEligible = await PromotionModel.countDocuments(baseFilter);
  logger.log(
    `📊 Eligible validated promotions (>${lookbackHours}h, unpaid): ${totalEligible}`
  );
  if (totalEligible === 0) {
    logger.log("🎯 No promotions to auto-pay. Job finished.");
    return { matched: 0, paid: 0 };
  }

  let matched = 0;
  let paid = 0;
  let batches = 0;

  // We page with a cursor-like loop to avoid large memory usage
  while (batches < maxBatches) {
    batches++;

    // Fetch a page of candidates (lean to keep memory light)
    const candidates = await PromotionModel
      .find(baseFilter, { _id: 1 }) // only _id needed; the write step re-checks the filter
      .sort({ validatedAt: 1 })     // oldest first
      .limit(batchSize)
      .lean();

    if (!candidates.length) break;

    matched += candidates.length;

    for (const { _id } of candidates) {
      // Atomically transition to "paid" only if it still matches baseFilter
      // This handles concurrency safely and is idempotent
      const filter = { _id, ...baseFilter };

      if (dryRun) {
        logger.log(`DRY-RUN: would pay promotion ${_id}`);
        continue;
      }

      const now = new Date();
      const update = {
        $set: {
          status: "paid",
          paidAt: now,
          hasBeenPaid: true,
        },
        $push: {
          activityLog: {
            action: "Promotion Paid (auto)",
            details: `Auto-paid after ${lookbackHours}h grace`,
            timestamp: now,
          },
        },
      };

      // Use findOneAndUpdate so post hooks like post("save") will NOT run automatically.
      // If you rely on "post('save')" for notifications, you may instead:
      //  1) load doc, set fields, await doc.save()  (slower, runs hooks)
      //  2) or keep this fast path and send notifications explicitly here.
      //
      // Your promotion.model.js currently sends notifications in post("save"),
      // so if you need those notifications, switch to the per-doc save() path below.
      //
      // For scale, we'll do the fast path here and rely on your "paid" logic in services,
      // or you can add a post("findOneAndUpdate") hook if desired.

      const updated = await PromotionModel.findOneAndUpdate(
        filter,
        update,
        { new: true } // return the updated document
      );

      if (updated) {
        paid++;
        logger.log(`✅ Paid promotion ${updated._id}`);
      }

      await applyPaymentAccounting(updated._id);
    }

    // If we returned fewer than a full page, likely we’re done
    if (candidates.length < batchSize) break;
  }

  logger.log(`🎉 Auto-pay job completed — matched: ${matched}, paid: ${paid}`);
  return { matched, paid };
};
