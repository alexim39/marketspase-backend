import cron from 'node-cron';
import { PromotionModel } from '../../../promotion/models/index.js';
import { UserModel } from '../../../user/models/user/index.js';
import { sendEmail } from '../../../../core/email.service.js';
import { wrapEmail } from '../../../../core/brand-email.js';

async function reconcilePayouts() {
  try {
    const now = new Date();
    const tenHoursAgo = new Date(now.getTime() - 10 * 60 * 60 * 1000);

    // Find promoters with reserved balance and active promotions past escrow hold
    const promotions = await PromotionModel.find({
      status: 'paid',
      'clickStats.earnedAmount': { $gt: 0 },
      paidAt: { $lte: tenHoursAgo },
    }).populate('promoter', 'displayName email wallets fraudProfile').lean();

    if (!promotions.length) return;

    let released = 0;
    let escalated = 0;

    for (const promo of promotions) {
      const trustScore = promo.promoter?.fraudProfile?.trustScore ?? 100;
      const reservedAmount = promo.clickStats?.earnedAmount || 0;
      const promoterId = promo.promoter?._id;

      if (!promoterId || reservedAmount <= 0) continue;

      // Trust-tiered logic
      if (trustScore >= 90) {
        // Instant release for trusted promoters
        await UserModel.updateOne({ _id: promoterId }, {
          $inc: { 'wallets.promoter.balance': reservedAmount, 'wallets.promoter.reserved': -reservedAmount },
        });
        await PromotionModel.updateOne({ _id: promo._id }, {
          $set: { 'payoutSnapshot.releasedAt': now },
        });
        released++;
      } else if (trustScore < 50) {
        // Hold and escalate for risky promoters
        escalated++;
        try {
          if (promo.promoter?.email) {
            sendEmail(promo.promoter.email, 'Payout Under Review',
              wrapEmail({ title: 'Payout Under Review', content: '<p>Your recent earnings are under review by our fraud team. This usually resolves within 24-48 hours.</p>', withFooter: true })
            ).catch(() => {});
          }
        } catch (e) {}
      }
      // TrustScore 50-89: standard 10-hour hold (handled by existing escrow-release.job.js)
    }

    if (released > 0 || escalated > 0) {
      console.log(`[Payout] Trust-tiered: ${released} instant-released, ${escalated} held for review`);
    }
  } catch (e) {
    console.error('[Payout] Reconciliation error:', e.message);
  }
}

export function initPayoutReconciliationCron() {
  cron.schedule('*/30 * * * *', reconcilePayouts);
  console.log('[CRON] Scheduled: Trust-tiered payout reconciliation (every 30 min)');
}
