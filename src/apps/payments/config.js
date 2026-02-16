// src/payments/config.js
export const PAYMENT_CONFIG = {
  // Service fees
  depositFeePercent: 0.10,      // 10% service fee on marketer deposits
  withdrawalFeePercent: 0.18,   // 18% service fee on promoter withdrawals (deducted only on success)

  // Webhook mount path (mount before express.json())
  webhookMountPath: "https://marketspase-96hm2qxb.b4a.run/api/webhook/paystack",
   //webhookMountPath: "/api/webhook/paystack",

  // Reconciliation schedule (cron expression)
  reconCron: "*/10 * * * *",

  // If Paystack sends a charge reference we don't know, should we auto-create a tx? (usually false)
  allowAutoCreateDepositTxIfMissing: false,
};