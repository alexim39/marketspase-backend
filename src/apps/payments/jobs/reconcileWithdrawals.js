// src/payments/jobs/reconcileWithdrawals.js
import { UserModel } from "../../user/models/user.model.js";
import { finalizeTransfer } from "../services/finalize.js";
import { paystackClient } from "../paystackClient.js";
import { verifyTransferByReference, fetchTransferByCode } from "../services/paystackTransferService.js";

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

      const candidates = [
        tx.providerReference,  // Paystack's reference (best)
        tx.reference,          // our internal ref (if Paystack honored it)
      ].filter(Boolean);

      let status, amountKobo, payload;

      try {
        // 1) Try reference-based verify
        let verified = false;
        for (const ref of candidates) {
          try {
            const data = await verifyTransferByReference(ref);
            if (data?.status === true && data?.data) {
              status = data.data.status;                 // success | failed | reversed | pending | blocked
              amountKobo = Number(data.data.amount || 0);
              payload = { ...data.data, event: "recon" };
              verified = true;
              break;
            }
          } catch (e) {
            // Not found by this ref; try next candidate
          }
        }

        // 2) Fallback: try by transfer_code if we have one
        if (!verified && tx.transferCode) {
          try {
            const data = await fetchTransferByCode(tx.transferCode);
            if (data?.status === true && data?.data) {
              status = data.data.status;
              amountKobo = Number(data.data.amount || 0);
              payload = { ...data.data, event: "recon" };
              verified = true;
            }
          } catch (e) {
            // still not found
          }
        }

        if (!verified) {
          console.warn(`⚠ Not found in provider for tx ref=${tx.reference} providerRef=${tx.providerReference || '-'} code=${tx.transferCode || '-'}`);
          continue; // keep it for next run; sometimes Paystack is eventual
        }

        // Map to finalizer
        if (status === "success") {
          await finalizeTransfer(tx.reference, "success", amountKobo, payload);
        } else if (status === "failed" || status === "blocked") {
          await finalizeTransfer(tx.reference, "failed", amountKobo, payload);
        } else if (status === "reversed") {
          await finalizeTransfer(tx.reference, "reversed", amountKobo, payload);
        } else {
          await finalizeTransfer(tx.reference, "pending", amountKobo, payload);
        }
      } catch (err) {
        console.error(`❗ Withdrawal recon error for ${tx.reference}:`, err?.response?.data || err.message);
      }
    }

    await user.save();
  }

  console.log("✅ Withdrawal Reconciliation Job Completed.");
}