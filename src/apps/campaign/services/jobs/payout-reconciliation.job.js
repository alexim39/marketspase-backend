import cron from 'node-cron';
import { PromotionModel } from '../../../promotion/models/index.js';
import { UserModel } from '../../../user/models/user/index.js';

async function reconcilePayouts() {
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000);

    // Only process PAID promotions that haven't been released yet
    const paidPromos = await PromotionModel.find({
      status: 'paid',
      'payoutSnapshot.releasedAt': { $exists: false },
    }).populate('promoter', '_id email fraudProfile wallets').lean();

    if (!paidPromos.length) return;

    let instant = 0, held = 0, skipped = 0;

    for (const promo of paidPromos) {
      const trustScore = promo.promoter?.fraudProfile?.trustScore ?? 100;
      const promoterId = promo.promoter?._id;
      if (!promoterId) { skipped++; continue; }

      // The campaign earnings were already moved to reserved when paid.
      // The amount is whatever is in wallets.promoter.reserved (from this campaign).
      // For safety, release the full reserved balance attributed to PPC earnings.
      const reserved = promo.promoter?.wallets?.promoter?.reserved || 0;
      if (reserved <= 0) { skipped++; continue; }

      // Trust ≥ 90: instant
      if (trustScore >= 90) {
        await UserModel.updateOne({ _id: promoterId }, {
          $inc: { 'wallets.promoter.balance': reserved, 'wallets.promoter.reserved': -reserved }
        });
        await PromotionModel.updateOne({ _id: promo._id }, {
          $set: { 'payoutSnapshot.releasedAt': new Date() }
        });
        instant++;
        continue;
      }

      // Others: 1hr hold from paidAt
      const paidAt = promo.paidAt ? new Date(promo.paidAt) : null;
      if (!paidAt || paidAt > oneHourAgo) { skipped++; continue; }

      await UserModel.updateOne({ _id: promoterId }, {
        $inc: { 'wallets.promoter.balance': reserved, 'wallets.promoter.reserved': -reserved }
      });
      await PromotionModel.updateOne({ _id: promo._id }, {
        $set: { 'payoutSnapshot.releasedAt': new Date() }
      });
      held++;
    }

    console.log(`[Payout] Paid releases: ${instant} instant, ${held} held (1hr), ${skipped} skipped`);
  } catch (e) {
    console.error('[Payout] Error:', e);
  }
}

export function initPayoutReconciliationCron() {
  cron.schedule('*/20 * * * *', reconcilePayouts);
  console.log('[CRON] Payout reconciliation active (every 20 min)');
}
