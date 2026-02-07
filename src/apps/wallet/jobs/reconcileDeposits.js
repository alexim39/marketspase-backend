// jobs/reconcileDeposits.js
import mongoose from "mongoose";
import axios from "axios";
import { UserModel } from "../../user/models/user.model.js";

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const VERIFY_URL = "https://api.paystack.co/transaction/verify/";

/**
 * Reconciliation job for stuck DEPOSIT (funding / charge) transactions
 */
export async function reconcileDeposits() {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

  console.log("🔄 Running Deposit Reconciliation Job...");

  // Find users with stuck deposit transactions
  const users = await UserModel.find({
    $or: [
      {
        "wallets.promoter.transactions": {
          $elemMatch: {
            category: "deposit",
            status: { $in: ["pending", "processing", "initiated"] },
            createdAt: { $lt: tenMinutesAgo },
            reference: { $exists: true, $ne: null }
          }
        }
      },
      {
        "wallets.marketer.transactions": {
          $elemMatch: {
            category: "deposit",
            status: { $in: ["pending", "processing", "initiated"] },
            createdAt: { $lt: tenMinutesAgo },
            reference: { $exists: true, $ne: null }
          }
        }
      }
    ]
  });

  if (!users.length) {
    console.log("✔ No stale deposit transactions found.");
    return;
  }

  for (const user of users) {
    // Loop through both wallets
    for (const walletName of ["promoter", "marketer"]) {
      const wallet = user.wallets[walletName];
      if (!wallet || !Array.isArray(wallet.transactions)) continue;

      for (const tx of wallet.transactions) {
        if (
          tx.category !== "deposit" ||
          !["pending", "processing", "initiated"].includes(tx.status) ||
          !tx.reference ||
          tx.createdAt > tenMinutesAgo
        ) {
          continue;
        }

        console.log(`🔍 Verifying stuck deposit: ref=${tx.reference} for user=${user._id}`);

        try {
          const response = await axios.get(
            `${VERIFY_URL}${tx.reference}`,
            {
              headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET}`
              }
            }
          );

          const data = response?.data?.data;
          const status = data?.status; // 'success' | 'failed' | 'abandoned' etc.
          const amountKobo = Number(data?.amount || 0);

          if (!data) {
            console.log(`⚠ No data returned for ref=${tx.reference}`);
            continue;
          }

          // ---- OUTCOME HANDLING ---- //
          if (status === "success") {
            // Credit wallet only once
            if (tx.status !== "successful") {
              wallet.balance += amountKobo; // Your system uses kobo
            }

            tx.status = "successful";
            tx.processedAt = new Date();
            tx.meta = { ...(tx.meta || {}), reconciled: true };

            console.log(`💰 Reconciled DEPOSIT SUCCESS: ${tx.reference}`);
          }

          else if (status === "failed") {
            tx.status = "failed";
            tx.failureReason = data.gateway_response || "Reconciled deposit failure";
            tx.processedAt = new Date();
            tx.meta = { ...(tx.meta || {}), reconciled: true };

            console.log(`❌ Reconciled DEPOSIT FAILED: ${tx.reference}`);
          }

          else if (status === "abandoned") {
            tx.status = "abandoned";
            tx.processedAt = new Date();
            tx.meta = { ...(tx.meta || {}), reconciled: true };

            console.log(`⚠ Reconciled DEPOSIT ABANDONED: ${tx.reference}`);
          }

          else {
            console.log(`⏳ Still pending deposit: ${tx.reference}`);
          }

        } catch (err) {
          console.error(
            `❗ Error verifying deposit ${tx.reference}:`,
            err.response?.data || err.message
          );
        }
      }
    }

    await user.save();
  }

  console.log("🔄 Deposit Reconciliation Job Completed.");
}