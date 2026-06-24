// Wallet DDD bootstrap — wires domain, application, and infrastructure
import { MongooseWalletRepository } from './infrastructure/gateways/mongoose-wallet-repository.gateway.js';
import { DebitWalletUseCase } from './application/use-cases/debit-wallet.use-case.js';
import { CreditWalletUseCase } from './application/use-cases/credit-wallet.use-case.js';

const walletRepository = new MongooseWalletRepository();

export const debitWalletUseCase = new DebitWalletUseCase({ walletRepository });
export const creditWalletUseCase = new CreditWalletUseCase({ walletRepository });

// Feature flag: set WALLET_DDD_ENABLED=true to route controllers through DDD use cases
export const isWalletDddEnabled = () => process.env.WALLET_DDD_ENABLED === 'true';
