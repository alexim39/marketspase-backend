import axios from "axios";

export const processPayment = async (bankCode, accountNumber, accountName, amount) => {
  try {
    // Step 1: Create a Paystack Transfer Recipient
    const recipientResponse = await axios.post(
      "https://api.paystack.co/transferrecipient",
      {
        type: "nuban",
        name: accountName,
        account_number: accountNumber,
        bank_code: bankCode,
        currency: "NGN",
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACKTOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!recipientResponse.data.status) {
      return { success: false, message: "Failed to create transfer recipient" };
    }

    const recipientCode = recipientResponse.data.data.recipient_code;

    // Step 2: Initiate the Transfer
    const transferResponse = await axios.post(
      "https://api.paystack.co/transfer",
      {
        source: "balance",
        amount: amount * 100, // Paystack accepts amount in kobo (multiply by 100)
        recipient: recipientCode,
        reason: "Withdrawal Payment",
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACKTOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (transferResponse.data.status) {
      return {
        success: true,
        transactionId: transferResponse.data.data.reference,
      };
    } else {
      return { success: false, message: "Transfer failed" };
    }
  } catch (error) {
    console.error("Payment processing failed:", error.response?.data || error.message);
    return { success: false, message: error.response?.data?.message || "An error occurred" };
  }
};
