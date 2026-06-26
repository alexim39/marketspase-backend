// Debit wallet use case — deducts funds with domain validation
import { Wallet } from '../../domain/entities/wallet.aggregate.js';

export class DebitWalletUseCase {
  constructor({ walletRepository }) {
    this.walletRepository = walletRepository;
  }

  async execute({ userId, side, amount, purpose, reference, session }) {
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

    wallet.debit(amount, purpose, reference);

    const tx = {
      amount, type: 'debit', category: purpose || 'debit',
      reference: reference || `txn_${Date.now()}`,
      createdAt: new Date(),
    };

    const saved = await this.walletRepository.debit({ userId, side, amount, session, transaction: tx });
    if (!saved) throw new Error(`Failed to persist wallet debit. Insufficient funds or wallet not found.`);

    return { success: true, balance: wallet.balance.amount - amount };
  }
}
