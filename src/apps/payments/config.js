// src/payments/config.js
export const PAYMENT_CONFIG = {
  // Service fees
  depositFeePercent: 0.10,        // 10% service fee on marketer DEPOSITS
  withdrawalFeePercent: 0.18,     // 18% service fee on promoter WITHDRAWALS

  // Webhook mount path
  webhookMountPath: "/api/webhook/paystack",

  // Reconciliation cadence (cron lives in index.js)
  reconCron: "*/10 * * * *",

  // If Paystack sends a deposit reference we don't know, should we create a tx?
  allowAutoCreateDepositTxIfMissing: false,
};