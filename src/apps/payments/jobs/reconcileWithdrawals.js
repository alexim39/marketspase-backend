// src/payments/jobs/reconcileWithdrawals.js
import { paystackClient } from "../paystackClient.js";
import { finalizeTransfer } from "../services/finalize.js";
import { UserModel } from "../../user/models/user.model.js";

export async function reconcileWithdrawals() {
  const cutoff = new Date(Date.now() - 10 * 60 * 1000);
  console.log("🔄 Running Withdrawal Reconciliation Job...");

  const users = await UserModel.find({
    "wallets.promoter.transactions": {
      $elemMatch: {
        category: "withdrawal",
        status: { $in: ["processing", "pending", "initiated"] },
        createdAt: { $lt: cutoff },
        reference: { $exists: true, $ne: null }
      }
    }
  });

  for (const user of users) {
    const wallet = user.wallets.promoter;

    for (const tx of wallet.transactions) {
      if (
        tx.category !== "withdrawal" ||
        !["processing", "pending", "initiated"].includes(tx.status) ||
        !tx.reference ||
        tx.createdAt > cutoff
      ) continue;

      try {
        const data = await paystackClient.verifyTransfer(tx.reference);
        if (!data) continue;

        const status = data.status;
        const amountKobo = Number(data.amount || 0);

        if (status === "success") {
          await finalizeTransfer(tx.reference, "success", amountKobo, { ...data, event: "recon" });
        } else if (status === "failed") {
          await finalizeTransfer(tx.reference, "failed", amountKobo, { ...data, event: "recon" });
        } else if (status === "reversed") {
          await finalizeTransfer(tx.reference, "reversed", amountKobo, { ...data, event: "recon" });
        } else {
          await finalizeTransfer(tx.reference, "pending", amountKobo, { ...data, event: "recon" });
        }
      } catch (err) {
        console.error(`❗ Withdrawal recon error for ${tx.reference}:`, err?.response?.data || err.message);
      }
    }

    await user.save();
  }

  console.log("✅ Withdrawal Reconciliation Job Completed.");
}