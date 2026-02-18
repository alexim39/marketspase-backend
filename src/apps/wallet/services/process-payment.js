// services/process-payment.js
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_API = 'https://api.paystack.co';

/**
 * Process payment/withdrawal through Paystack (No OTP version)
 */
export const processPayment = async (bankCode, accountNumber, accountName, amount, metadata) => {
  try {
    console.log('Processing payment:', { bankCode, accountNumber, accountName, amount, metadata });

    // Step 1: Resolve account to verify details
    const accountDetails = await resolveAccount(bankCode, accountNumber);
    
    if (!accountDetails.status || !accountDetails.data) {
      return {
        success: false,
        status: 'failed',
        message: 'Account verification failed',
        insufficientBalance: false
      };
    }

    // Verify account name matches (case insensitive)
    const resolvedName = accountDetails.data.account_name.toLowerCase().trim();
    const providedName = accountName.toLowerCase().trim();
    
    if (!resolvedName.includes(providedName) && !providedName.includes(resolvedName)) {
      return {
        success: false,
        status: 'failed',
        message: 'Account name mismatch. Expected: ' + accountDetails.data.account_name,
        insufficientBalance: false
      };
    }

    // Step 2: Create transfer recipient
    const recipient = await createTransferRecipient(
      accountName,
      accountNumber,
      bankCode,
      metadata.userId
    );

    if (!recipient.status || !recipient.data) {
      return {
        success: false,
        status: 'failed',
        message: 'Failed to create transfer recipient',
        insufficientBalance: false
      };
    }

    // Step 3: Initiate transfer (OTP disabled, so should be immediate)
    const transfer = await initiateTransfer(
      amount,
      recipient.data.recipient_code,
      metadata.reference,
      metadata.reason || 'Withdrawal from MarketSpase'
    );

    // Handle transfer outcomes
    if (transfer.status) {
      // Check if transfer was successful immediately
      if (transfer.data.status === 'success') {
        return {
          success: true,
          status: 'success',
          message: 'Transfer completed successfully',
          reference: metadata.reference,
          providerReference: transfer.data.reference || transfer.data.transfer_code,
          transferCode: transfer.data.transfer_code,
          requiresApproval: false,
          insufficientBalance: false,
          data: transfer.data
        };
      } 
      // If still processing (but should be rare with OTP disabled)
      else if (transfer.data.status === 'pending' || transfer.data.status === 'processing') {
        return {
          success: true,
          status: 'processing',
          message: 'Transfer is being processed',
          reference: metadata.reference,
          providerReference: transfer.data.reference || transfer.data.transfer_code,
          transferCode: transfer.data.transfer_code,
          requiresApproval: false,
          insufficientBalance: false,
          data: transfer.data
        };
      }
      else {
        return {
          success: true,
          status: transfer.data.status,
          message: transfer.message || 'Transfer initiated',
          reference: metadata.reference,
          providerReference: transfer.data.reference || transfer.data.transfer_code,
          transferCode: transfer.data.transfer_code,
          requiresApproval: false,
          insufficientBalance: false,
          data: transfer.data
        };
      }
    } else {
      // Check if it's insufficient balance
      if (transfer.message && (
        transfer.message.includes('insufficient balance') || 
        transfer.message.includes('Insufficient Balance')
      )) {
        return {
          success: false,
          status: 'failed',
          message: 'Insufficient Paystack balance',
          insufficientBalance: true
        };
      }

      return {
        success: false,
        status: 'failed',
        message: transfer.message || 'Transfer failed',
        insufficientBalance: false
      };
    }

  } catch (error) {
    console.error('Process payment error:', error);
    
    // Check if error is due to insufficient balance in Paystack
    if (error.response && error.response.data && error.response.data.message) {
      const message = error.response.data.message;
      if (message.includes('insufficient balance') || message.includes('Insufficient Balance')) {
        return {
          success: false,
          status: 'failed',
          message: 'Insufficient Paystack balance',
          insufficientBalance: true
        };
      }
    }

    return {
      success: false,
      status: 'failed',
      message: error.message || 'Payment processing failed',
      insufficientBalance: false
    };
  }
};

/**
 * Resolve bank account details
 */
async function resolveAccount(bankCode, accountNumber) {
  try {
    const response = await axios.get(`${PAYSTACK_API}/bank/resolve`, {
      params: {
        account_number: accountNumber,
        bank_code: bankCode
      },
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Resolve account error:', error.response?.data || error.message);
    return {
      status: false,
      message: error.response?.data?.message || 'Account resolution failed'
    };
  }
}

/**
 * Create transfer recipient
 */
async function createTransferRecipient(name, accountNumber, bankCode, userId) {
  try {
    const response = await axios.post(`${PAYSTACK_API}/transferrecipient`, {
      type: 'nuban',
      name: name,
      account_number: accountNumber,
      bank_code: bankCode,
      currency: 'NGN',
      metadata: {
        userId: userId,
        source: 'withdrawal_request'
      }
    }, {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Create recipient error:', error.response?.data || error.message);
    return {
      status: false,
      message: error.response?.data?.message || 'Recipient creation failed'
    };
  }
}

/**
 * Initiate transfer
 */
async function initiateTransfer(amount, recipientCode, reference, reason) {
  try {
    const response = await axios.post(`${PAYSTACK_API}/transfer`, {
      source: 'balance',
      amount: amount,
      recipient: recipientCode,
      reference: reference,
      reason: reason,
      currency: 'NGN'
    }, {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Initiate transfer error:', error.response?.data || error.message);
    return {
      status: false,
      message: error.response?.data?.message || 'Transfer initiation failed'
    };
  }
}

/**
 * Check Paystack balance
 */
export const checkPaystackBalance = async () => {
  try {
    const response = await axios.get(`${PAYSTACK_API}/balance`, {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`
      }
    });
    
    if (response.data.status && response.data.data.length > 0) {
      return {
        success: true,
        balance: response.data.data[0].balance,
        currency: response.data.data[0].currency
      };
    }
    
    return {
      success: false,
      balance: 0,
      message: 'No balance information found'
    };
  } catch (error) {
    console.error('Check balance error:', error.response?.data || error.message);
    return {
      success: false,
      balance: 0,
      message: error.response?.data?.message || 'Failed to check balance'
    };
  }
};