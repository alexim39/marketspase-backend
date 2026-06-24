export const isFinancialDddEnabled = () => process.env.FINANCIAL_DDD_ENABLED === 'true';
export { Transaction, FinancialError } from './domain/entities/transaction.aggregate.js';
