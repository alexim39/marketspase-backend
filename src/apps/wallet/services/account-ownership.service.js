
// src/apps/payments/services/account-ownership.service.js
import mongoose from 'mongoose';
import { UserModel } from '../../user/models/user/index.js';

/**
 * Normalize accountNumber and accountName to minimize false negatives.
 * - strips spaces and non-digits for accountNumber
 * - collapses multiple spaces and uppercases for accountName
 */
function normalizeBankPayload({ bankCode, accountNumber, accountName }) {
  const norm = {
    bankCode: String(bankCode || '').trim(),
    accountNumber: String(accountNumber || '').replace(/\D/g, ''), // digits only
    accountName: String(accountName || '').replace(/\s+/g, ' ').trim().toUpperCase(),
  };
  return norm;
}

/**
 * Checks whether the given bank details are already associated with a different user.
 * Returns an object describing conflict status and the matched owner (if any).
 *
 * @param {{ bankCode: string, accountNumber: string, accountName?: string, userId: string }} params
 * @returns {Promise<{conflict: boolean, ownerUserId?: string, source?: 'savedAccount'|'transaction'}>}
 */
export async function assertAccountNotUsedByAnotherUser(params) {
  const { userId } = params;
  const { bankCode, accountNumber, accountName } = normalizeBankPayload(params);

  if (!userId || !bankCode || !accountNumber) {
    // Keep this strict: missing details should be blocked by the controller before calling the service
    throw new Error('Missing required bank account details for ownership check.');
  }

  const userIdObj = mongoose.Types.ObjectId.isValid(userId)
    ? new mongoose.Types.ObjectId(userId)
    : userId;

  // ---- Search 1: saved payout accounts on other users
  const savedAccountOwner = await UserModel.findOne({
    _id: { $ne: userIdObj },
    savedAccounts: {
      $elemMatch: {
        bankCode: bankCode,
        accountNumber: accountNumber,
      },
    },
    isDeleted: { $ne: true },
  })
    .select('_id')
    .lean();

  if (savedAccountOwner?._id) {
    return { conflict: true, ownerUserId: String(savedAccountOwner._id), source: 'savedAccount' };
  }

  // ---- Search 2: prior transactions bankDetails on other users (promoter wallet)
  const transactionOwner = await UserModel.findOne({
    _id: { $ne: userIdObj },
    isDeleted: { $ne: true },
    'wallets.promoter.transactions': {
      $elemMatch: {
        category: 'withdrawal',
        'bankDetails.bankCode': bankCode,
        'bankDetails.accountNumber': accountNumber,
      },
    },
  })
    .select('_id')
    .lean();

  if (transactionOwner?._id) {
    return { conflict: true, ownerUserId: String(transactionOwner._id), source: 'transaction' };
  }

  // (Optional) If you want to be extra strict, also match accountName loosely:
  // You could add additional $or branches comparing normalized names or Levenshtein,
  // but be careful with false positives.

  return { conflict: false };
}
