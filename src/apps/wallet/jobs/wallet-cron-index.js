import cron from "node-cron";
import { reconcileWithdrawals } from "./reconcileWithdrawals.js";
import { reconcileDeposits } from "./reconcileDeposits.js";

cron.schedule("*/10 * * * *", async () => {
  console.log("🕒 Wallet Reconciliation Cron Job Started");
  await reconcileWithdrawals();
  await reconcileDeposits();
});