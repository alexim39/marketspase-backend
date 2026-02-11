// services/promotionPayout.service.js
import mongoose from 'mongoose';
import { PromotionModel } from '../../apps/promotion/models/promotion.model.js';
import { CampaignModel } from '../../apps/campaign/models/campaign.model.js';
import { UserModel } from '../../apps/user/models/user.model.js';
import { toMinor } from './money.util.js';

export async function payPromotion({ promotionId, paidByUserId }) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const promo = await PromotionModel.findById(promotionId).session(session);
      if (!promo) throw new Error('Promotion not found');
      if (promo.hasBeenPaid) return; // idempotent guard [4](https://saipem-my.sharepoint.com/personal/alex_imenwo_saipem_com1/Documents/Microsoft%20Copilot%20Chat%20Files/promotion.model.js)

      const campaign = await CampaignModel.findById(promo.campaign).session(session);
      if (!campaign) throw new Error('Campaign not found');

      const marketer = await UserModel.findById(campaign.owner).session(session);
      const promoter = await UserModel.findById(promo.promoter).session(session);
      if (!marketer || !promoter) throw new Error('Users not found');

      // Compute payout NGN from campaign (use your existing numeric fields) [3](https://saipem-my.sharepoint.com/personal/alex_imenwo_saipem_com1/Documents/Microsoft%20Copilot%20Chat%20Files/campaign.model.js)
      const payoutMinor = toMinor(campaign.payoutPerPromotion, 'NGN');

      // === Marketer: move from reserved -> debit balance (legacy majors)
      {
        const w = marketer.wallets.marketer;
        const reservedMinor = toMinor(w.reserved ?? 0, 'NGN');
        if (reservedMinor < payoutMinor) throw new Error('Reserved funds insufficient');

        w.reserved = (reservedMinor - payoutMinor) / 100;
        const balanceMinor = toMinor(w.balance ?? 0, 'NGN'); // should be unchanged now
        w.balance = balanceMinor / 100;

        w.transactions.unshift({
          reference: `payout-d:${promotionId}`,
          gateway: 'internal',
          currency: 'NGN',
          amount: -(payoutMinor / 100),
          type: 'debit',
          category: 'promotion',
          status: 'successful',
          description: `Payout for promotion ${promo._id}`,
          relatedPromotion: promo._id,
          processedAt: new Date()
        });
      }

      // === Promoter: credit
      {
        const w = promoter.wallets.promoter;
        const balanceMinor = toMinor(w.balance ?? 0, 'NGN');
        w.balance = (balanceMinor + payoutMinor) / 100;

        w.transactions.unshift({
          reference: `payout-c:${promotionId}`,
          gateway: 'internal',
          currency: 'NGN',
          amount: payoutMinor / 100,
          type: 'credit',
          category: 'promotion',
          status: 'successful',
          description: `Payout for promotion ${promo._id}`,
          relatedPromotion: promo._id,
          processedAt: new Date()
        });
      }

      // Update promo lifecycle idempotently (your model already enforces paid flag) [4](https://saipem-my.sharepoint.com/personal/alex_imenwo_saipem_com1/Documents/Microsoft%20Copilot%20Chat%20Files/promotion.model.js)
      promo.status = 'paid';
      promo.hasBeenPaid = true;
      promo.payoutAmount = payoutMinor / 100;
      promo.paidBy = paidByUserId;
      promo.paidAt = new Date();

      // Update campaign counters (spentBudget/totalPayouts) in your existing services as you do today [3](https://saipem-my.sharepoint.com/personal/alex_imenwo_saipem_com1/Documents/Microsoft%20Copilot%20Chat%20Files/campaign.model.js)
      campaign.spentBudget += (payoutMinor / 100);
      campaign.totalPayouts += (payoutMinor / 100);

      await marketer.save({ session });
      await promoter.save({ session });
      await promo.save({ session });
      await campaign.save({ session });
    });
  } finally {
    session.endSession();
  }
}