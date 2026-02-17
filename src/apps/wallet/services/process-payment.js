import {
  getOrCreateRecipient,
  initiateTransfer,
  approveTransfer
} from "../../payments/services/paystackTransferService.js";

/**
 * Unified withdrawal processor using real payment engine
 */
export const processPayment = async (
  bankCode,
  accountNumber,
  accountName,
  amountKobo,
  meta = {}
) => {
  try {

    /**
     * STEP 1 — Get recipient from main engine
     */
    const recipientCode = await getOrCreateRecipient({
      name: accountName,
      accountNumber,
      bankCode,
      currency: "NGN"
    });

    /**
     * STEP 2 — Initiate transfer
     */
    const transfer = await initiateTransfer({
      amountKobo,
      recipientCode,
      reason: meta.reason || "Withdrawal Payment",
      reference: meta.reference
    });

    /**
     * STEP 3 — Handle BLOCKED immediately
     */
    if (transfer.status === "blocked") {

      console.log("⚠ Transfer blocked — attempting approval");

      if (transfer.transfer_code) {
        await approveTransfer(transfer.transfer_code);

        console.log("✅ Transfer approved automatically");

        return {
          success: true,
          reference: transfer.reference,
          transferCode: transfer.transfer_code,
          status: "pending",
          message: "Transfer approved & processing"
        };
      }

      return {
        success: false,
        message: "Blocked transfer without transfer code"
      };
    }

    /**
     * STEP 4 — Normal states
     */
    if (transfer.status === "success") {
      return {
        success: true,
        reference: transfer.reference,
        transferCode: transfer.transfer_code,
        status: "success"
      };
    }

    if (transfer.status === "pending") {
      return {
        success: true,
        reference: transfer.reference,
        transferCode: transfer.transfer_code,
        status: "pending"
      };
    }

    return {
      success: false,
      reference: transfer.reference,
      message: transfer.message || "Transfer failed"
    };

  } catch (error) {

    console.error("Payment processing failed:", error.response?.data || error.message);

    return {
      success: false,
      message: error?.response?.data?.message || "Payment error"
    };
  }
};