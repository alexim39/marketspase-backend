import { UserModel } from '../models/user.model.js';

/**
 * Add funds to marketer wallet (deposit).
 */
export async function depositFunds(userId, amount, description = 'Wallet deposit') {
  const user = await UserModel.findById(userId);
  if (!user) throw new Error('User not found');

  user.wallets.marketer.balance += amount;

  user.wallets.marketer.transactions.push({
    amount,
    type: 'credit',
    category: 'deposit',
    description,
    status: 'successful',
  });

  await user.save();
  return user.wallets.marketer;
}

/**
 * Reserve marketer funds for a campaign (escrow).
 */
export async function reserveFundsForCampaign(userId, campaignId, amount) {
  const user = await UserModel.findById(userId);
  if (!user) throw new Error('User not found');

  if (user.wallets.marketer.balance < amount) {
    throw new Error('Insufficient balance to reserve funds');
  }

  user.wallets.marketer.balance -= amount;
  user.wallets.marketer.reserved += amount;

  user.wallets.marketer.transactions.push({
    amount,
    type: 'debit',
    category: 'campaign',
    description: `Reserved funds for Campaign ${campaignId}`,
    relatedCampaign: campaignId,
    status: 'pending',
  });

  await user.save();
  return user.wallets.marketer;
}

/**
 * Release escrowed funds to promoter after verification.
 */
export async function releaseEscrow(marketerId, promoterId, campaignId, promotionId, amount) {
  const marketer = await UserModel.findById(marketerId);
  const promoter = await UserModel.findById(promoterId);

  if (!marketer || !promoter) throw new Error('User(s) not found');

  if (marketer.wallets.marketer.reserved < amount) {
    throw new Error('Insufficient reserved funds');
  }

  // Deduct from marketer reserved
  marketer.wallets.marketer.reserved -= amount;
  marketer.wallets.marketer.transactions.push({
    amount,
    type: 'debit',
    category: 'campaign',
    description: `Released escrow for Campaign ${campaignId}`,
    relatedCampaign: campaignId,
    status: 'successful',
  });

  // Credit promoter
  promoter.wallets.promoter.balance += amount;
  promoter.wallets.promoter.transactions.push({
    amount,
    type: 'credit',
    category: 'promotion',
    description: `Earning from Promotion ${promotionId}`,
    relatedPromotion: promotionId,
    relatedCampaign: campaignId,
    status: 'successful',
  });

  await marketer.save();
  await promoter.save();
  return { marketerWallet: marketer.wallets.marketer, promoterWallet: promoter.wallets.promoter };
}

/**
 * Withdraw funds from promoter wallet to bank/mobile money.
 */
export async function withdrawFunds(userId, amount, description = 'Withdrawal') {
  const user = await UserModel.findById(userId);
  if (!user) throw new Error('User not found');

  if (user.wallets.promoter.balance < amount) {
    throw new Error('Insufficient funds');
  }

  user.wallets.promoter.balance -= amount;
  user.wallets.promoter.transactions.push({
    amount,
    type: 'debit',
    category: 'withdrawal',
    description,
    status: 'pending', // mark pending until payment gateway confirms
  });

  await user.save();
  return user.wallets.promoter;
}
