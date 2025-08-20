import { UserModel } from '../models/user.model.js';

/**
 * Add funds to advertiser wallet (deposit).
 */
export async function depositFunds(userId, amount, description = 'Wallet deposit') {
  const user = await UserModel.findById(userId);
  if (!user) throw new Error('User not found');

  user.wallets.advertiser.balance += amount;

  user.wallets.advertiser.transactions.push({
    amount,
    type: 'credit',
    category: 'deposit',
    description,
    status: 'successful',
  });

  await user.save();
  return user.wallets.advertiser;
}

/**
 * Reserve advertiser funds for a campaign (escrow).
 */
export async function reserveFundsForCampaign(userId, campaignId, amount) {
  const user = await UserModel.findById(userId);
  if (!user) throw new Error('User not found');

  if (user.wallets.advertiser.balance < amount) {
    throw new Error('Insufficient balance to reserve funds');
  }

  user.wallets.advertiser.balance -= amount;
  user.wallets.advertiser.reserved += amount;

  user.wallets.advertiser.transactions.push({
    amount,
    type: 'debit',
    category: 'campaign',
    description: `Reserved funds for Campaign ${campaignId}`,
    relatedCampaign: campaignId,
    status: 'pending',
  });

  await user.save();
  return user.wallets.advertiser;
}

/**
 * Release escrowed funds to promoter after verification.
 */
export async function releaseEscrow(advertiserId, promoterId, campaignId, promotionId, amount) {
  const advertiser = await UserModel.findById(advertiserId);
  const promoter = await UserModel.findById(promoterId);

  if (!advertiser || !promoter) throw new Error('User(s) not found');

  if (advertiser.wallets.advertiser.reserved < amount) {
    throw new Error('Insufficient reserved funds');
  }

  // Deduct from advertiser reserved
  advertiser.wallets.advertiser.reserved -= amount;
  advertiser.wallets.advertiser.transactions.push({
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

  await advertiser.save();
  await promoter.save();
  return { advertiserWallet: advertiser.wallets.advertiser, promoterWallet: promoter.wallets.promoter };
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
