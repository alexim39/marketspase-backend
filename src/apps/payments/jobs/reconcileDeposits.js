// src/payments/jobs/reconcileDeposits.js
import { paystackClient } from "../paystackClient.js";
import { finalizeDeposit } from "../services/finalize.js";
import { UserModel } from "../../user/models/user.model.js";

export async function reconcileDeposits() {
  const cutoff = new Date(Date.now() - 10 * 60 * 1000);
  console.log("🔄 Running Deposit Reconciliation Job...");

  const users = await UserModel.find({
    "wallets.marketer.transactions": {
      $elemMatch: {
        category: "deposit",
        status: { $in: ["pending", "processing", "initiated"] },
        createdAt: { $lt: cutoff },
        reference: { $exists: true, $ne: null }
      }
    }
  });

  for (const user of users) {
    const wallet = user.wallets.marketer;

    for (const tx of wallet.transactions) {
      if (
        tx.category !== "deposit" ||
        !["pending", "processing", "initiated"].includes(tx.status) ||
        !tx.reference ||
        tx.createdAt > cutoff
      ) continue;

      try {
        const data = await paystackClient.verifyCharge(tx.reference);
        if (!data) continue;

        const status = data.status;
        const amountKobo = Number(data.amount || 0);

        if (status === "success") {
          await finalizeDeposit(tx.reference, amountKobo, { event: "recon", customer: data?.customer });
        } else if (status === "failed") {
          tx.status = "failed";
          tx.failureReason = data.gateway_response || "Deposit failed";
          tx.processedAt = new Date();
        } else if (status === "abandoned") {
          tx.status = "abandoned";
          tx.processedAt = new Date();
        } // else pending → leave as-is
      } catch (err) {
        console.error(`❗ Deposit recon error for ${tx.reference}:`, err?.response?.data || err.message);
      }
    }

    await user.save();
  }

  console.log("✅ Deposit Reconciliation Job Completed.");
}