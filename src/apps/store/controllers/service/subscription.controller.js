import { ServiceModel } from '../../models/service/service.model.js';
import { StoreModel } from '../../models/store/index.js';
import { UserModel } from '../../../user/models/user/index.js';

const SUBSCRIPTION_TIERS = { free: 0, basic: 5000, pro: 15000 };

export const activateSubscription = async (req, res) => {
  try {
    const { storeId, tier } = req.body;
    if (!SUBSCRIPTION_TIERS[tier]) return res.status(400).json({ success: false, message: 'Invalid tier' });

    const store = await StoreModel.findOne({ _id: storeId, owner: req.userId, type: 'service' });
    if (!store) return res.status(404).json({ success: false, message: 'Service store not found' });

    const amount = SUBSCRIPTION_TIERS[tier];
    if (amount > 0) {
      const user = await UserModel.findById(req.userId);
      const wallet = user?.wallets?.marketer;
      if (!wallet || wallet.balance < amount) return res.status(402).json({ success: false, message: 'Insufficient wallet balance' });
      await UserModel.updateOne({ _id: req.userId }, {
        $inc: { 'wallets.marketer.balance': -amount },
        $push: {
          'wallets.marketer.transactions': {
            $each: [{
              amount, type: 'debit', category: 'subscription',
              description: `Service store subscription — ${tier} plan (30 days)`,
              status: 'completed', createdAt: new Date(),
              meta: { storeId, tier, plan: tier },
            }],
            $position: 0,
          },
        },
      });
    }

    await ServiceModel.updateMany({ store: storeId }, { $set: { subscriptionTier: tier, subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } });

    return res.json({ success: true, data: { tier, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};
