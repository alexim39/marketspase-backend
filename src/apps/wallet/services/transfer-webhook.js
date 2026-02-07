// services/transfer-webhook.js
import { UserModel } from '../../user/models/user.model.js';
import { sendEmail } from "../../../services/email.service.js";
import { withdrawalSuccessfulTemplate } from './email/withdrawalSuccessfulTemplate.js';
import { withdrawalFailedTemplate } from './email/withdrawalFailedTemplate.js';

// Utility: locate a transaction by reference across both wallets
function findTxAcrossWallets(user, reference) {
  const pIdx = user.wallets?.promoter?.transactions?.findIndex(t => t.reference === reference) ?? -1;
  if (pIdx >= 0) return { wallet: 'promoter', index: pIdx, tx: user.wallets.promoter.transactions[pIdx] };

  const mIdx = user.wallets?.marketer?.transactions?.findIndex(t => t.reference === reference) ?? -1;
  if (mIdx >= 0) return { wallet: 'marketer', index: mIdx, tx: user.wallets.marketer.transactions[mIdx] };

  return null;
}

function getWallet(user, which) {
  return which === 'promoter' ? user.wallets.promoter : user.wallets.marketer;
}

// ---------- TRANSFER (withdrawals) ----------
export const handleTransferWebhook = async (event) => {
  try {
    const { data: transferData, event: eventType } = event;
    const ref = transferData?.reference;

    console.log(`Processing webhook: ${eventType} for reference: ${ref}`);

    // Find the user based on existing transaction reference in promoter wallet (withdrawals are promoter-sided)
    // (keep your original search, but we’ll also check marketer if needed)
    const users = await UserModel.find({
      $or: [
        { 'wallets.promoter.transactions.reference': ref },
        { 'wallets.marketer.transactions.reference': ref }
      ]
    });

    if (!users.length) {
      console.log(`No user found for transaction reference: ${ref}`);
      return;
    }

    const user = users[0];
    const found = findTxAcrossWallets(user, ref);
    if (!found) {
      console.log(`Transaction not found for reference: ${ref}`);
      return;
    }

    const { wallet, tx } = found;
    const w = getWallet(user, wallet);

    // Idempotency: if already finalized, no-op
    if (['successful', 'failed', 'reversed', 'refunded', 'cancelled'].includes(tx.status)) {
      console.log(`Transaction already finalized: ${ref} (${tx.status})`);
      return;
    }

    // Normalize Paystack amounts (kobo)
    const amountKobo = Number(transferData?.amount ?? 0);

    switch (eventType) {
      case 'transfer.success':
        tx.status = 'successful';
        tx.processedAt = new Date();
        tx.transferCode = transferData?.transfer_code;
        tx.meta = { ...(tx.meta || {}), lastEvent: eventType, gateway: 'paystack' };

        // No balance change on success if you already deducted on withdrawal request
        console.log(`Transfer successful for user: ${user._id}, amount: ${amountKobo / 100}`);
        try {
          const emailContent = withdrawalSuccessfulTemplate({
            userName: user.displayName,
            amount: tx.amount,
            accountNumber: (tx.description?.match(/ending in (\d+)/) || [])[1] || '****',
            bankName: (tx.description?.match(/to \((.+?)\) account/) || [])[1] || 'your bank',
            fee: tx.fee,
            newBalance: user.wallets.promoter.balance
          });
          await sendEmail(user.email, 'Withdrawal Successful - MarketSpase', emailContent);
        } catch (emailError) {
          console.error('Failed to send success email notification:', emailError);
        }
        break;

      case 'transfer.failed': {
        tx.status = 'failed';
        tx.failureReason = transferData?.reason || transferData?.message || 'Transfer failed';
        tx.processedAt = new Date();
        tx.meta = { ...(tx.meta || {}), lastEvent: eventType, gateway: 'paystack' };

        // Refund (amount + fee) back to the same wallet
        const refundAmount = (tx.amount || amountKobo) + (tx.fee || 0);
        w.balance += refundAmount;
        console.log(`Transfer failed for user: ${user._id}, refunded: ${refundAmount}`);

        try {
          const emailContent = withdrawalFailedTemplate({
            userName: user.displayName,
            amount: tx.amount,
            accountNumber: (tx.description?.match(/ending in (\d+)/) || [])[1] || '****',
            bankName: (tx.description?.match(/to \((.+?)\) account/) || [])[1] || 'your bank',
            reason: tx.failureReason,
            refundedAmount: refundAmount,
            newBalance: w.balance
          });
          await sendEmail(user.email, 'Withdrawal Failed - MarketSpase', emailContent);
        } catch (emailError) {
          console.error('Failed to send failure email notification:', emailError);
        }
        break;
      }

      case 'transfer.reversed': {
        tx.status = 'reversed';
        tx.processedAt = new Date();
        tx.meta = { ...(tx.meta || {}), lastEvent: eventType, gateway: 'paystack' };

        // Refund (amount + fee)
        const reversedAmount = (tx.amount || amountKobo) + (tx.fee || 0);
        w.balance += reversedAmount;
        console.log(`Transfer reversed for user: ${user._id}, refunded: ${reversedAmount}`);
        break;
      }

      case 'transfer.pending':
        tx.status = 'processing';
        tx.meta = { ...(tx.meta || {}), lastEvent: eventType, gateway: 'paystack' };
        console.log(`Transfer pending for user: ${user._id}`);
        break;

      default:
        console.log(`Unhandled webhook event: ${eventType}`);
        return;
    }

    await user.save();
    console.log(`Webhook processed successfully for user: ${user._id}`);
  } catch (error) {
    console.error('Webhook processing error:', error);
    throw error;
  }
};

// ---------- CHARGE (deposits) ----------
export const handleChargeWebhook = async (event) => {
  try {
    const { data, event: eventType } = event;
    const ref = data?.reference;
    const status = data?.status; // 'success' | 'failed'
    const amountKobo = Number(data?.amount ?? 0);
    const feesKobo = Number(data?.fees ?? 0);

    // Decide target wallet:
    // Use metadata.wallet = 'marketer' | 'promoter' if you set it at initialize; default marketer otherwise.
    const targetWallet = (data?.metadata?.wallet === 'promoter') ? 'promoter' : 'marketer';
    const userIdMeta = data?.metadata?.userId; // if you set it at initialize
    const email = data?.customer?.email;

    // Find user by (1) transaction reference if it already exists in either wallet,
    // (2) metadata.userId, or (3) email fallback.
    const users = await UserModel.find({
      $or: [
        { 'wallets.promoter.transactions.reference': ref },
        { 'wallets.marketer.transactions.reference': ref },
        ...(userIdMeta ? [{ _id: userIdMeta }] : []),
        ...(email ? [{ email }] : [])
      ]
    });

    if (!users.length) {
      console.warn(`charge webhook: no user found for reference=${ref}, email=${email}, userId=${userIdMeta}`);
      return;
    }
    const user = users[0];

    // Try to locate existing tx first
    const existing = findTxAcrossWallets(user, ref);
    const walletName = existing?.wallet || targetWallet;
    const w = getWallet(user, walletName);

    // If no existing tx, create one
    let tx = existing?.tx;
    if (!tx) {
      tx = {
        reference: ref,
        gateway: 'paystack',
        currency: data?.currency || 'NGN',
        fee: feesKobo,
        amount: amountKobo,
        type: 'credit',
        category: 'deposit',
        description: `Paystack charge ${ref}`,
        status: 'pending',
        meta: {},
        createdAt: new Date()
      };
      w.transactions.unshift(tx);
    }

    // Idempotent finalize
    if (['successful', 'failed', 'refunded', 'reversed', 'cancelled'].includes(tx.status)) {
      console.log(`charge webhook: already finalized ${ref} (${tx.status})`);
      return;
    }

    if (eventType === 'charge.success' && status === 'success') {
      tx.status = 'successful';
      tx.processedAt = new Date();
      tx.meta = { ...(tx.meta || {}), lastEvent: eventType, gateway: 'paystack', raw: { customer: data?.customer?.id } };

      // Exactly-once credit (only when moving into 'successful')
      // NOTE: amounts are in kobo – keep consistency with your wallet unit.
      w.balance += amountKobo;
      console.log(`charge.success → credited ${amountKobo / 100} to ${walletName} wallet for user ${user._id}`);
    } else if (eventType === 'charge.failed' || status === 'failed') {
      tx.status = 'failed';
      tx.processedAt = new Date();
      tx.failureReason = data?.gateway_response || 'Charge failed';
      tx.meta = { ...(tx.meta || {}), lastEvent: eventType, gateway: 'paystack' };
      console.log(`charge.failed for user ${user._id}, ref=${ref}`);
    } else {
      // Keep pending; reconciliation job can re-verify later
      tx.status = (tx.status === 'pending') ? 'pending' : tx.status;
      tx.meta = { ...(tx.meta || {}), lastEvent: eventType, gateway: 'paystack' };
      console.log(`charge pending/unknown for user ${user._id}, ref=${ref}`);
    }

    await user.save();
  } catch (err) {
    console.error('charge webhook processing error:', err);
    throw err;
  }
};