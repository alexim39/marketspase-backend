// src/payments/services/finalize.js
import { PAYMENT_CONFIG } from "../config.js";
import { UserModel } from "../../user/models/user.model.js";


function findTxAcrossWallets(user, reference) {
  const pIdx = user.wallets?.promoter?.transactions?.findIndex(t => t.reference === reference) ?? -1;
  if (pIdx >= 0) return { wallet: "promoter", tx: user.wallets.promoter.transactions[pIdx] };
  const mIdx = user.wallets?.marketer?.transactions?.findIndex(t => t.reference === reference) ?? -1;
  if (mIdx >= 0) return { wallet: "marketer", tx: user.wallets.marketer.transactions[mIdx] };
  return null;
}


/** DEPOSIT (marketer): credit net 90% (10% fee) exactly once */
export async function finalizeDeposit(reference, amountKobo, rawMeta) {
  let user = await UserModel.findOne({ "wallets.marketer.transactions.reference": reference });

  // Optional autocreate path (usually disabled)
  if (!user) return false;

  const { tx } = findTxAcrossWallets(user, reference) || {};
  if (!tx) return false;

  if (["successful", "failed", "refunded", "reversed", "cancelled", "abandoned"].includes(tx.status)) {
    return true;
  }

  const fee = Math.round(amountKobo * PAYMENT_CONFIG.depositFeePercent);
  const net = amountKobo - fee;

  tx.status = "successful";
  tx.fee = fee;
  tx.processedAt = new Date();
  tx.meta = { ...(tx.meta || {}), finalizeSource: rawMeta?.event || "recon" };

  user.wallets.marketer.balance += net;
  await user.save();
  return true;
}


export async function finalizeTransfer(reference, outcome, amountKobo, details = {}) {
  const user = await UserModel.findOne({
    $or: [
      { "wallets.promoter.transactions.reference": reference },
      { "wallets.marketer.transactions.reference": reference }
    ]
  });
  if (!user) return false;

  const found = findTxAcrossWallets(user, reference);
  if (!found) return false;

  const { wallet, tx } = found;
  const w = user.wallets[wallet];

  if (["successful", "failed", "reversed", "refunded", "cancelled", "abandoned"].includes(tx.status)) {
    return true;
  }

  // IMPORTANT:
  // - tx.amount = gross (requested) that you deducted from wallet at initiation
  // - tx.amountPayable = net (paid out) you sent to Paystack
  // - fee = tx.amount - tx.amountPayable (or computed)
  const gross = Number(tx.amount || 0);
  const net = Number(tx.amountPayable || 0);

  // If older records don't have amountPayable, fallback:
  const computedFee = Math.round(gross * PAYMENT_CONFIG.withdrawalFeePercent);
  const fee = tx.fee ?? (gross && net ? (gross - net) : computedFee);

  switch (outcome) {
    case "success": {
      tx.status = "successful";
      tx.transferCode = details.transfer_code;
      tx.processedAt = new Date();
      tx.fee = fee;
      tx.meta = { ...(tx.meta || {}), finalizeSource: details.event || "recon" };

      // ✅ DO NOT deduct fee from wallet here anymore.
      // Fee is already embedded because we paid net out of gross at initiation.
      break;
    }

    case "failed":
    case "reversed": {
      // ✅ Refund gross (what you initially debited)
      w.balance += gross;
      tx.status = outcome;
      tx.failureReason =
        details.reason || details.message || (outcome === "failed" ? "Transfer failed" : "Transfer reversed");
      tx.processedAt = new Date();
      tx.fee = 0; // nothing charged if payout failed
      tx.meta = { ...(tx.meta || {}), finalizeSource: details.event || "recon", refunded: gross };
      break;
    }

    case "pending": {
      tx.status = "processing";
      tx.meta = { ...(tx.meta || {}), finalizeSource: details.event || "recon" };
      break;
    }
  }

  await user.save();
  return true;
}
