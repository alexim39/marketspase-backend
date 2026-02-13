// src/payments/services/process-payment.js
import { getOrCreateRecipient, initiateTransfer } from "./paystackTransferService.js";

/**
 * Back-compatible signature:
 *   processPayment(bankCode, accountNumber, accountName, amountKobo, opts?)
 *
 * opts:
 *   - userId?: string
 *   - reason?: string
 *   - reference?: string    // idempotency for provider & for webhook/recon matching
 */
export async function processPayment(bankCode, accountNumber, accountName, amountKobo, opts = {}) {
  try {
    const { userId, reason, reference } = opts;

    // 1) Ensure recipient_code (cached by (bankCode, accountNumber))
    const recipientCode = await getOrCreateRecipient({
      userId,
      name: accountName || "MarketSpase User",
      accountNumber,
      bankCode,
      currency: "NGN",
    });

    // 2) Initiate the transfer (KOBO)
    const res = await initiateTransfer({
      amountKobo,
      recipientCode,
      reason: reason || "Withdrawal Payment - MarketSpase",
      reference,
    });

    const status = res.status; // 'success' | 'pending' | 'failed' | 'blocked'(rare)
    const isBlocked = status?.toLowerCase() === "blocked";
    const isInsufficient = /insufficient/i.test(res.message || "");

    return {
      success: res.ok,
      status,
      reference: res.reference,
      transferCode: res.transfer_code, 
      requiresApproval: false,          // OTP flow not used
      insufficientBalance: isInsufficient,
      message: res.message || (isBlocked ? "Transfer blocked" : ""),
    };
  } catch (e) {
    const msg = e?.response?.data?.message || e?.message || "Payment failed";
    const lower = (msg || "").toLowerCase();
    return {
      success: false,
      status: lower.includes("block") ? "blocked" : "failed",
      reference: null,
      requiresApproval: false,
      insufficientBalance: lower.includes("insufficient"),
      message: msg,
    };
  }
}