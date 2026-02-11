// services/campaignReservation.service.js
import mongoose from 'mongoose';
import { CampaignModel } from '../../apps/campaign/models/campaign.model.js';
import { UserModel } from '../../apps/user/models/user.model.js';
import { toMinor } from './money.util.js';

export async function reservePayoutForAcceptance({ campaignId, promoterId }) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const campaign = await CampaignModel.findById(campaignId).session(session);
      if (!campaign) throw new Error('Campaign not found');

      // Ensure campaign gate
      const ok = campaign.assignPromoter(); // updates counters, does NOT move money [3](https://saipem-my.sharepoint.com/personal/alex_imenwo_saipem_com1/Documents/Microsoft%20Copilot%20Chat%20Files/campaign.model.js)
      if (!ok) throw new Error('Campaign not active/available');

      // Marketer is campaign.owner; reserve NGN payout in their marketer wallet
      const marketer = await UserModel.findById(campaign.owner).session(session);
      if (!marketer) throw new Error('Owner not found');

      const w = marketer.wallets?.marketer;
      const payoutMinor = toMinor(campaign.payoutPerPromotion, 'NGN'); // numeric NGN -> kobo [3](https://saipem-my.sharepoint.com/personal/alex_imenwo_saipem_com1/Documents/Microsoft%20Copilot%20Chat%20Files/campaign.model.js)

      // Check and move from balance to reserved (legacy majors mirrored via integer math)
      const currentMinor = toMinor(w.balance ?? 0, 'NGN');
      if (currentMinor < payoutMinor) throw new Error('Insufficient marketer balance');

      const newMinor = currentMinor - payoutMinor;
      w.balance = newMinor / 100;
      w.reserved = (toMinor(w.reserved ?? 0, 'NGN') + payoutMinor) / 100;

      // Optional: record a 'reserved' transaction for traceability (category 'reserved_credit') [2](https://saipem-my.sharepoint.com/personal/alex_imenwo_saipem_com1/Documents/Microsoft%20Copilot%20Chat%20Files/transaction.schema.js)
      w.transactions.unshift({
        reference: `reserve:${campaignId}:${promoterId}`,
        gateway: 'internal',
        currency: 'NGN',
        amount: -(payoutMinor / 100),
        type: 'debit',
        category: 'reserved_credit',
        status: 'reserved',
        description: 'Reserve payout for acceptance',
        relatedCampaign: campaign._id,
        processedAt: new Date()
      });

      await campaign.save({ session });
      await marketer.save({ session });
    });
  } finally {
    session.endSession();
  }
}
