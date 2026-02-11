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

  if (!user) {
    if (!PAYMENT_CONFIG.allowAutoCreateDepositTxIfMissing) return false;
    // Optional: attempt to find by email metadata
    const email = rawMeta?.data?.customer?.email || rawMeta?.customer?.email;
    user = email ? await UserModel.findOne({ email }) : null;
    if (!user) return false;

    user.wallets.marketer.transactions.unshift({
      reference,
      gateway: "paystack",
      currency: rawMeta?.data?.currency || "NGN",
      fee: 0,
      amount: amountKobo,
      type: "credit",
      category: "deposit",
      description: `Paystack charge ${reference}`,
      status: "pending",
      createdAt: new Date(),
      meta: {},
    });
  }

  const { tx } = findTxAcrossWallets(user, reference) || {};
  if (!tx) return false;

  // Already finalized?
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

/** WITHDRAWAL (promoter): success=no balance move (already deducted); failure/reversed=refund amount+fee (OPTION B) */
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

  // If already terminal, no-op
  if (["successful", "failed", "reversed", "refunded", "cancelled", "abandoned"].includes(tx.status)) {
    return true;
  }

  switch (outcome) {
    case "success": {
      // Payout succeeded → nothing to refund; fee already captured at request time
      tx.status = "successful";
      tx.transferCode = details.transfer_code;
      tx.processedAt = new Date();
      tx.meta = { ...(tx.meta || {}), finalizeSource: details.event || "recon" };
      break;
    }
    case "failed":
    case "reversed": {
      // Per OPTION B: refund BOTH amount and fee back to the same wallet
      const refund = (tx.amount || 0) + (tx.fee || 0);
      w.balance += refund;

      tx.status = outcome;
      tx.failureReason = details.reason || details.message || (outcome === "failed" ? "Transfer failed" : "Transfer reversed");
      tx.processedAt = new Date();
      tx.meta = { ...(tx.meta || {}), finalizeSource: details.event || "recon", refunded: refund };
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