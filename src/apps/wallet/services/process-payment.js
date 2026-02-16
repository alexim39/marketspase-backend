import axios from "axios";

const PAYSTACK_BASE_URL = "https://api.paystack.co";

const paystackHeaders = (secret) => ({
  Authorization: `Bearer ${secret}`,
  "Content-Type": "application/json",
});

/**
 * Find existing recipient OR create one
 */
const getOrCreateRecipient = async (secret, bankCode, accountNumber, accountName) => {
  try {
    // 1. Try to create recipient (Paystack safely deduplicates internally)
    const response = await axios.post(
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

    if (!response.data.status) {
      return { success: false, message: response.data.message };
    }

    return {
      success: true,
      recipientCode: response.data.data.recipient_code,
    };
  } catch (error) {
    const err = error.response?.data;
    return {
      success: false,
      message: err?.message || "Recipient creation failed",
    };
  }
};

/**
 * Process Withdrawal Transfer
 */
export const processPayment = async (
  bankCode,
  accountNumber,
  accountName,
  amount, // already in KOBO
  meta = {}
) => {
  try {
    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

    if (!PAYSTACK_SECRET_KEY) {
      throw new Error("Missing Paystack Secret Key");
    }

    /**
     * STEP 1 — Get recipient safely
     */
    const recipient = await getOrCreateRecipient(
      PAYSTACK_SECRET_KEY,
      bankCode,
      accountNumber,
      accountName
    );

    if (!recipient.success) {
      return {
        success: false,
        message: recipient.message || "Failed to prepare recipient",
      };
    }

    /**
     * STEP 2 — Initiate transfer (SAFE MODE)
     * DO NOT force instant sending
     * Let Paystack risk engine process normally
     */
     const transferResponse = await axios.post(
      `${PAYSTACK_BASE_URL}/transfer`,
      {
        source: "balance",
        amount: amount < 100 ? amount * 100 : amount,
        recipient: recipient.recipientCode,
        reason: meta.reason || "Withdrawal Payment",
        reference:
          meta.reference ||
          `WD_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
      },
      { headers: paystackHeaders(PAYSTACK_SECRET_KEY) }
    );

    const transferData = transferResponse.data.data;

    if (!transferResponse.data.status) {
      return {
        success: false,
        message: transferResponse.data.message || "Transfer failed",
      };
    }

    /**
     * STEP 3 — Interpret Paystack status safely
     */

    // SUCCESS
    if (transferData.status === "success") {
      return {
        success: true,
        reference: transferData.reference,
        transferCode: transferData.transfer_code,
        status: "success",
        message: "Transfer completed successfully",
      };
    }

    // PENDING (Normal auto-processing state)
    if (transferData.status === "pending") {
      return {
        success: true,
        reference: transferData.reference,
        transferCode: transferData.transfer_code,
        status: "pending",
        message: "Transfer is being processed",
      };
    }

    // OTP required (rare if OTP disabled)
    if (transferData.status === "otp") {
      return {
        success: true,
        reference: transferData.reference,
        transferCode: transferData.transfer_code,
        status: "pending",
        requiresOTP: true,
        message: "Transfer awaiting OTP finalization",
      };
    }

    // Approval required
    if (transferData.requires_approval === 1) {
      return {
        success: false,
        requiresApproval: true,
        reference: transferData.reference,
        message: "Transfer requires Paystack approval",
      };
    }

    // Any other state
    return {
      success: false,
      reference: transferData.reference,
      message: `Unhandled transfer status: ${transferData.status}`,
    };
  } catch (error) {
    console.error("Payment processing failed:", error.response?.data || error.message);

    const err = error.response?.data;

    if (err?.data?.code === "transfer_requires_approval") {
      return {
        success: false,
        requiresApproval: true,
        message: "Transfer requires manual approval",
      };
    }

    if (err?.data?.code === "insufficient_balance") {
      return {
        success: false,
        insufficientBalance: true,
        message: "Insufficient Paystack balance",
      };
    }

    return {
      success: false,
      message: err?.message || "Payment processing error",
      code: err?.data?.code,
    };
  }
};