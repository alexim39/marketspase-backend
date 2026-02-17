import axios from "axios";

const PAYSTACK_BASE_URL = "https://api.paystack.co";

const paystackHeaders = (secret) => ({
  Authorization: `Bearer ${secret}`,
  "Content-Type": "application/json",
});

/**
 * Create (or dedup) recipient on Paystack
 * NOTE: Paystack deduplicates internally, so we can call this safely.
 */
const getOrCreateRecipient = async (secret, bankCode, accountNumber, accountName) => {
  try {
    const resp = await axios.post(
      `${PAYSTACK_BASE_URL}/transferrecipient`,
      {
        type: "nuban",
        name: accountName,
        account_number: accountNumber,
        bank_code: bankCode,
        currency: "NGN",
      },
      { headers: paystackHeaders(secret) }
    );

    if (!resp?.data?.status) {
      return { success: false, message: resp?.data?.message || "Recipient creation failed" };
    }

    const recipient_code = resp?.data?.data?.recipient_code;
    if (!recipient_code) {
      return { success: false, message: "Recipient code missing from provider response" };
    }

    return { success: true, recipientCode: recipient_code };
  } catch (error) {
    const err = error?.response?.data;
    return {
      success: false,
      message: err?.message || "Recipient creation failed",
    };
  }
};

/**
 * Process Withdrawal Transfer (amount is KOBO)
 * meta: { reference?: string, reason?: string }
 */
export const processPayment = async (
  bankCode,
  accountNumber,
  accountName,
  amountKobo, // MUST be KOBO
  meta = {}
) => {
  try {
    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
    if (!PAYSTACK_SECRET_KEY) throw new Error("Missing Paystack Secret Key");

    // 1) Recipient
    const recipient = await getOrCreateRecipient(
      PAYSTACK_SECRET_KEY,
      bankCode,
      accountNumber,
      accountName
    );
    if (!recipient.success) {
      return { success: false, message: recipient.message || "Failed to prepare recipient" };
    }

    // 2) Initiate transfer with KOBO amount; include our reference for idempotency
    const payload = {
      source: "balance",
      amount: amountKobo,                      // KOBO ONLY – do not scale here
      recipient: recipient.recipientCode,
      reason: meta.reason || "Withdrawal Payment",
      reference:
        meta.reference ||
        `WD_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
    };

    const transferResp = await axios.post(
      `${PAYSTACK_BASE_URL}/transfer`,
      payload,
      { headers: paystackHeaders(PAYSTACK_SECRET_KEY) }
    );

    if (!transferResp?.data?.status) {
      // Provider reported top-level failure
      return {
        success: false,
        reference: transferResp?.data?.data?.reference || payload.reference || null,
        transferCode: transferResp?.data?.data?.transfer_code || null,
        message: transferResp?.data?.message || "Transfer failed",
      };
    }

    const d = transferResp?.data?.data || {};
    const providerRef = d?.reference || payload.reference || null;
    const transferCode = d?.transfer_code || null;
    const status = (d?.status || "pending").toLowerCase();

    // Normalize immediate outcomes
    if (status === "success") {
      return {
        success: true,
        status: "success",
        reference: providerRef,
        transferCode,
        message: "Transfer completed successfully",
      };
    }

    if (status === "pending" || status === "otp") {
      return {
        success: true,
        status: "pending", // we treat otp as pending in our engine
        reference: providerRef,
        transferCode,
        requiresOTP: status === "otp",
        message: status === "otp" ? "Transfer awaiting OTP finalization" : "Transfer is being processed",
      };
    }

    if (status === "blocked") {
      return {
        success: false,
        status: "blocked",
        reference: providerRef,
        transferCode,
        message: "Transfer blocked by provider",
      };
    }

    // requires_approval flag (legacy)
    if (d?.requires_approval === 1) {
      return {
        success: false,
        requiresApproval: true,
        reference: providerRef,
        transferCode,
        message: "Transfer requires Paystack approval",
      };
    }

    // Any other error-ish status
    return {
      success: false,
      status,
      reference: providerRef,
      transferCode,
      message: `Unhandled transfer status: ${d?.status || "unknown"}`,
    };
  } catch (error) {
    const err = error?.response?.data;
    const code = err?.data?.code || err?.code;
    const msg = err?.message || error?.message || "Payment processing error";
    const body = err?.data || {};
    const lower = (msg || "").toLowerCase();

    const isInsufficient = code === "insufficient_balance" || lower.includes("insufficient");
    const isBlocked = code?.includes("block") || lower.includes("block");

    return {
      success: false,
      status: isBlocked ? "blocked" : "failed",
      reference: body?.reference || null,
      transferCode: body?.transfer_code || null,
      insufficientBalance: isInsufficient,
      requiresApproval: code === "transfer_requires_approval",
      message: msg,
      code,
    };
  }
};