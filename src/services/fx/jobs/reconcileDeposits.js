// jobs/reconcileDeposits.js
import { verifyPayment } from '../gateways/paystack.client.js'; // your verify wrapper
import { UserModel } from '../../../apps/user/models/user.model.js';
import { creditWalletWithTx } from '../wallet.service.js';
import { toNGNMinorFrom } from '../services/money.util.js';

export async function reconcileDeposits({ sinceMinutes = 120 }) {
  // Find 'pending' or 'initiated' deposit txs in embedded arrays (optimize with projections)
  const cutoff = new Date(Date.now() - sinceMinutes * 60 * 1000);
  const users = await UserModel.find({
    $or: [
      { 'wallets.marketer.transactions': { $elemMatch: { category: 'deposit', status: { $in: ['pending','initiated'] }, createdAt: { $gte: cutoff } } } },
      { 'wallets.promoter.transactions': { $elemMatch: { category: 'deposit', status: { $in: ['pending','initiated'] }, createdAt: { $gte: cutoff } } } }
    ]
  }).select('wallets');

  for (const u of users) {
    for (const role of ['marketer','promoter']) {
      const txs = (u.wallets?.[role]?.transactions || []).filter(
        t => t.category === 'deposit' && (t.status === 'pending' || t.status === 'initiated')
      );

      for (const tx of txs) {
        const vr = await verifyPayment(tx.reference); // calls Paystack /transaction/verify
        if (!vr?.status) continue;

        const originalCurrency = (vr.currency || tx.currency || 'NGN').toUpperCase();
        const originalAmountMinor = Number(vr.amount);
        const feeMinor = Number(vr.fees ?? 0);
        const rateToNGN = Number(vr.exchange_rate ?? 1);

        const ngnGrossMinor = toNGNMinorFrom(originalAmountMinor, originalCurrency, rateToNGN);
        const ngnFeeMinor   = toNGNMinorFrom(feeMinor,           originalCurrency, rateToNGN);
        const ngnNetMinor   = ngnGrossMinor - ngnFeeMinor;

        // Mutate tx in-place and credit if needed
        tx.currency = originalCurrency;
        tx.amount   = originalAmountMinor / 100;
        tx.fee      = feeMinor / 100;
        tx.amountPayable = ngnNetMinor / 100; // legacy NGN field
        tx.status = vr.status ? 'successful' : 'failed';
        tx.meta = {
          ...(tx.meta || {}),
          fx: { sourceCurrency: originalCurrency, targetCurrency: 'NGN', rate: rateToNGN, provider: 'gateway', asOf: new Date() },
          verify: vr
        };
      }
    }
    await u.save();
  }
}
``