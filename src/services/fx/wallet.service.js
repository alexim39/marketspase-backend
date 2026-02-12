// services/wallet.service.js
import mongoose from 'mongoose';
import { UserModel } from '../../apps/user/models/user.model.js';

function findRoleWallet(userDoc, role) {
  const w = userDoc.wallets?.[role];
  if (!w) throw new Error(`Wallet for role '${role}' not found`);
  return w;
}

/**
 * Idempotently append a transaction to a role wallet if not exists.
 * Returns { modified: boolean, txIndex: number }
 */
function upsertEmbeddedTransaction(roleWallet, tx) {
  const exists = (roleWallet.transactions || []).some(t =>
    String(t.reference) === String(tx.reference) && String(t.gateway) === String(tx.gateway)
  );
  if (exists) return { modified: false, txIndex: -1 };
  roleWallet.transactions = roleWallet.transactions || [];
  roleWallet.transactions.unshift(tx);
  return { modified: true, txIndex: 0 };
}

/**
 * Credit wallet balance atomically and insert transaction idempotently.
 * Uses a single save() (Mongoose will compute $inc internally across fields in doc),
 * but for extreme throughput, move to direct update with $inc + $push with $position:0.
 */
export async function creditWalletWithTx({ userId, role, amountNgnMinor, tx }) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const user = await UserModel.findById(userId).session(session);
      if (!user) throw new Error('User not found');

      const w = findRoleWallet(user, role);
      const { modified } = upsertEmbeddedTransaction(w, tx);
      if (!modified) return; // idempotent no-op

      // balances are legacy majors; keep both updated
      w.balance = ((w.balance ?? 0) + fromMinor(amountNgnMinor, 'NGN'));
      // Also keep a shadow kobo if you choose (optional); we won't add schema fields here.

      await user.save({ session });
    });
  } finally {
    session.endSession();
  }
}

export async function debitWalletWithTx({ userId, role, amountNgnMinor, tx }) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const user = await UserModel.findById(userId).session(session);
      if (!user) throw new Error('User not found');

      const w = findRoleWallet(user, role);
      const availableMinor = toMinor(w.balance ?? 0, 'NGN'); // legacy balance in major
      if (availableMinor < amountNgnMinor) throw new Error('Insufficient balance');

      const { modified } = upsertEmbeddedTransaction(w, tx);
      if (!modified) return; // idempotent no-op

      // update legacy major
      const newMinor = availableMinor - amountNgnMinor;
      w.balance = fromMinor(newMinor, 'NGN');

      await user.save({ session });
    });
  } finally {
    session.endSession();
  }
}
