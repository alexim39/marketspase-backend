// Infrastructure — Mongoose implementation using existing guarded wallet operations
import { UserModel } from '../../../user/models/user/index.js';
import { moveWithinWallet } from '../../services/wallet-move.service.js';

export class MongooseWalletRepository {
  async findByUserId(userId, side) {
    const user = await UserModel.findById(userId)
      .select(`wallets.${side}`)
      .lean();
    if (!user?.wallets?.[side]) return null;

    const w = user.wallets[side];
    return {
      balance: w.balance || 0,
      reserved: w.reserved || 0,
      currency: w.currency || 'NGN',
    };
  }

  /**
   * Persist a credit operation. Uses guarded $inc for atomicity.
   */
  async credit({ userId, side, amount, session, transaction }) {
    const update = {
      $inc: { [`wallets.${side}.balance`]: amount },
    };
    if (transaction) {
      update.$push = { [`wallets.${side}.transactions`]: transaction };
    }
    const result = await UserModel.updateOne({ _id: userId }, update, { session });
    return result.modifiedCount > 0;
  }

  /**
   * Persist a debit operation using the existing guarded moveWithinWallet service.
   * Debit is a negative balance movement with balance guard.
   */
  async debit({ userId, side, amount, session, transaction }) {
    const update = { $inc: {} };
    // Guard: balance must be >= amount
    const guard = { [`wallets.${side}.balance`]: { $gte: amount } };

    update.$inc[`wallets.${side}.balance`] = -amount;
    if (transaction) {
      update.$push = { [`wallets.${side}.transactions`]: transaction };
    }

    const result = await UserModel.updateOne(
      { _id: userId, ...guard },
      update,
      { session },
    );
    return result.modifiedCount > 0;
  }
}
