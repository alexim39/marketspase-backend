// jobs/reconcileWithdrawals.js
import mongoose from "mongoose";
import axios from "axios";
import { UserModel } from "../../user/models/user.model.js";

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const VERIFY_URL = "https://api.paystack.co/transfer/verify/"; 
// NOTE: For CHARGE verification use: https://api.paystack.co/transaction/verify/:reference

/**
 * Reconciliation job for stuck withdrawal transactions
 */
export async function reconcileWithdrawals() {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

  console.log("🔄 Running Withdrawal Reconciliation Job...");

  // Find users with stuck promoter withdrawal transactions
  const users = await UserModel.find({
    "wallets.promoter.transactions": {
      $elemMatch: {
        category: "withdrawal",
        status: { $in: ["processing", "pending", "initiated"] },
        createdAt: { $lt: tenMinutesAgo },
        reference: { $exists: true, $ne: null }
      },
    }
  });

  if (!users.length) {
    console.log("✔ No stale withdrawal transactions found.");
    return;
  }

  for (const user of users) {
    const promoterWallet = user.wallets.promoter;

    for (const tx of promoterWallet.transactions) {
      if (
        tx.category !== "withdrawal" ||
        !["processing", "pending", "initiated"].includes(tx.status) ||
        !tx.reference ||
        tx.createdAt > tenMinutesAgo
      ) {
        continue;
      }

      console.log(
        `🔍 Verifying stuck withdrawal: ref=${tx.reference}, user=${user._id}`
      );

      try {
        const response = await axios.get(
          `${VERIFY_URL}${tx.reference}`,
          {
            headers: {
              Authorization: `Bearer ${PAYSTACK_SECRET}`,
            }
          }
        );

        const data = response?.data?.data;
        const status = data?.status;

        if (!data) {
          console.log(`⚠ No data returned for ref=${tx.reference}`);
          continue;
        }

        // ---- OUTCOME HANDLING ---- //
        if (status === "success") {
          tx.status = "successful";
          tx.processedAt = new Date();
          tx.transferCode = data.transfer_code;
          tx.meta = { ...(tx.meta || {}), reconciled: true };

          console.log(`✅ Reconciled SUCCESS: ${tx.reference}`);
        }

        else if (status === "failed") {
          // Refund wallet (only once)
          if (tx.status !== "failed" && tx.status !== "refunded") {
            promoterWallet.balance += tx.amount;
          }

          tx.status = "failed";
          tx.failureReason = data.reason || "Reconciled failure";
          tx.processedAt = new Date();
          tx.meta = { ...(tx.meta || {}), reconciled: true };

          console.log(`❌ Reconciled FAILED: ${tx.reference}`);
        }

        else if (status === "reversed") {
          // Refund wallet (only once)
          if (tx.status !== "reversed") {
            promoterWallet.balance += tx.amount;
          }

          tx.status = "reversed";
          tx.processedAt = new Date();
          tx.meta = { ...(tx.meta || {}), reconciled: true };

          console.log(`↩️ Reconciled REVERSED: ${tx.reference}`);
        }

        else {
          console.log(`⏳ Still pending: ${tx.reference}`);
        }

      } catch (err) {
        console.error(
          `❗ Error reconciling ${tx.reference}:`,
          err.response?.data || err.message
        );
      }
    }

    await user.save();
  }

  console.log("🔄 Withdrawal Reconciliation Job Completed.");
}