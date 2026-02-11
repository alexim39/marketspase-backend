// src/payments/index.js
import cron from "node-cron";
import { PAYMENT_CONFIG } from "./config.js";
import { buildPaymentRouter } from "./router.js";
import { reconcileDeposits } from "./jobs/reconcileDeposits.js";
import { reconcileWithdrawals } from "./jobs/reconcileWithdrawals.js";

export function registerPaymentEngine(app, options = {}) {
  const cfg = { ...PAYMENT_CONFIG, ...(options || {}) };

  // Mount webhooks BEFORE any global express.json()
  app.use(cfg.webhookMountPath, buildPaymentRouter());
  console.log(`✅ Payment Engine webhook mounted at ${cfg.webhookMountPath}`);

  // Cron
  if (options.enableCron !== false) {
    cron.schedule(cfg.reconCron, async () => {
      await reconcileDeposits();
      await reconcileWithdrawals();
    });
    console.log(`⏱️ Payment Engine reconciliation scheduled: ${cfg.reconCron}`);
  }
}