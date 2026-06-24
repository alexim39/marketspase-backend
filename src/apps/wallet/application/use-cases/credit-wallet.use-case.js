// Credit wallet use case — adds funds with domain validation
import { Wallet } from '../../domain/entities/wallet.aggregate.js';

export class CreditWalletUseCase {
  constructor({ walletRepository }) {
    this.walletRepository = walletRepository;
  }

  async execute({ userId, side, amount, source, reference, session }) {
    if (!userId || !side) throw new Error('userId and side are required.');
    if (!amount || amount <= 0) throw new Error('amount must be greater than 0.');

    const data = await this.walletRepository.findByUserId(userId, side);
    if (!data) throw new Error(`Wallet not found for ${side}`);

    const wallet = new Wallet({
      userId, side,
      balance: data.balance || 0,
      reserved: data.reserved || 0,
      currency: data.currency || 'NGN',
    });

    wallet.credit(amount, source, reference);

    const tx = {
      amount, type: 'credit', category: source || 'credit',
      reference: reference || `txn_${Date.now()}`,
      createdAt: new Date(),
    };

    await this.walletRepository.credit({ userId, side, amount, session, transaction: tx });

    return { success: true, balance: wallet.balance.amount + amount };
  }
}
