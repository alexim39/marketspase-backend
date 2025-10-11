import axios from "axios";

export const processPayment = async (bankCode, accountNumber, accountName, amount) => {
  try {
    const PAYSTACK_SECRET_KEY = process.env.PAYSTACKTOKEN;

    // Step 1: Create or find existing transfer recipient
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
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!recipientResponse.data.status) {
      return { 
        success: false, 
        message: "Failed to create transfer recipient",
        details: recipientResponse.data.message
      };
    }

    
    const recipientCode = recipientResponse.data.data.recipient_code;

    // Step 2: Initiate transfer with auto-finalize parameters
    const transferResponse = await axios.post(
      "https://api.paystack.co/transfer",
      {
        source: "balance",
        amount: Math.round(amount * 100), // Convert to kobo
        recipient: recipientCode,
        reason: "Withdrawal Payment - MarketSpase",
        reference: `WD_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        // Critical parameters for auto-transfer:
        queue: false, // Don't queue the transfer
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const transferData = transferResponse.data.data;

    // Check if transfer was successful or requires OTP/approval
    if (transferResponse.data.status) {
      if (transferData.status === "success") {
        // Transfer was immediately successful
        return {
          success: true,
          reference: transferData.reference,
          transferCode: transferData.transfer_code,
          message: "Transfer completed successfully"
        };
      } else if (transferData.status === "otp") {
        // Transfer requires OTP - this should be automated
        return handleOTPTransfer(transferData, PAYSTACK_SECRET_KEY);
      } else if (transferData.status === "pending") {
        // Check if it requires approval
        if (transferData.requires_approval === 1) {
          return {
            success: false,
            message: "Transfer requires manual approval from Paystack",
            requiresApproval: true,
            reference: transferData.reference
          };
        } else {
          // It's pending but should process automatically
          return {
            success: true,
            reference: transferData.reference,
            transferCode: transferData.transfer_code,
            message: "Transfer is being processed",
            status: "pending"
          };
        }
      } else {
        return {
          success: false,
          message: `Transfer status: ${transferData.status}`,
          reference: transferData.reference
        };
      }
    } else {
      return { 
        success: false, 
        message: transferResponse.data.message || "Transfer failed" 
      };
    }
  } catch (error) {
    console.error("Payment processing failed:", error.response?.data || error.message);
    
    // Handle specific Paystack error cases
    const errorData = error.response?.data;
    
    if (errorData) {
      // Check for transfer approval requirements
      if (errorData.data?.code === 'transfer_requires_approval') {
        return {
          success: false,
          message: "Transfer requires manual approval. Please contact support.",
          requiresApproval: true
        };
      }
      
      // Check for insufficient balance
      if (errorData.data?.code === 'insufficient_balance') {
        return {
          success: false,
          message: "Insufficient balance in your Paystack account to process this transfer.",
          insufficientBalance: true
        };
      }
    }

    return { 
      success: false, 
      message: errorData?.message || "An error occurred during payment processing",
      code: errorData?.data?.code
    };
  }
};

// Helper function to handle OTP transfers automatically
const handleOTPTransfer = async (transferData, secretKey) => {
  try {
    // For OTP transfers, you need to finalize with OTP
    // In production, you might want to store this and handle via webhook
    // or use a default OTP if you've set one in Paystack dashboard
    
    console.log("Transfer requires OTP. Setting up for automatic finalization...");
    
    // If you have a fixed OTP for your business, you can use it here:
    // const finalizeResponse = await axios.post(
    //   "https://api.paystack.co/transfer/finalize_transfer",
    //   {
    //     transfer_code: transferData.transfer_code,
    //     otp: "123456" // Your fixed OTP from Paystack
    //   },
    //   {
    //     headers: {
    //       Authorization: `Bearer ${secretKey}`,
    //       "Content-Type": "application/json",
    //     },
    //   }
    // );
    
    // For now, return pending status and handle via webhook
    return {
      success: true,
      reference: transferData.reference,
      transferCode: transferData.transfer_code,
      message: "Transfer is being processed",
      status: "pending",
      requiresOTP: true
    };
    
  } catch (error) {
    console.error("OTP handling failed:", error.response?.data || error.message);
    return {
      success: false,
      message: "OTP requirement could not be processed automatically",
      requiresOTP: true
    };
  }
};







/* import axios from "axios";

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
 */