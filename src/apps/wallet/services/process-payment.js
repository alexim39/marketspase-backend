// services/process-payment.js
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_API = 'https://api.paystack.co';

export const processPayment = async (bankCode, accountNumber, accountName, amount, metadata) => {
  try {
    console.log('Processing payment with metadata:', metadata);

    const koboAmount = amount * 100;

    // Step 1: Resolve account
    const accountDetails = await resolveAccount(bankCode, accountNumber);
    
    if (!accountDetails.status || !accountDetails.data) {
      return {
        success: false,
        status: 'failed',
        message: 'Account verification failed',
        insufficientBalance: false
      };
    }

    // Verify account name
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

    // IMPORTANT: Use the reference from metadata
    const reference = metadata.reference;
    console.log('Using reference for transfer:', reference);

    // Step 3: Initiate transfer with OUR reference
    const transfer = await initiateTransfer(
      koboAmount,
      recipient.data.recipient_code,
      reference,
      metadata.reason || 'MarketSpase withdrawal'
    );

    console.log('Full transfer response:', JSON.stringify(transfer, null, 2));

    // Check if transfer was successful
    if (transfer.status === true) {
      return {
        success: true,
        status: transfer.data?.status || 'pending',
        message: transfer.message || 'Transfer initiated',
        reference: reference,  // OUR reference
        providerReference: transfer.data?.reference || transfer.data?.transfer_code || reference,
        transferCode: transfer.data?.transfer_code,
        requiresApproval: false,
        insufficientBalance: false,
        data: transfer.data
      };
    } else {
      // Check for insufficient balance
      if (transfer.message && transfer.message.toLowerCase().includes('insufficient balance')) {
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
    return {
      success: false,
      status: 'failed',
      message: error.message || 'Payment processing failed',
      insufficientBalance: false
    };
  }
};

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

async function initiateTransfer(amount, recipientCode, reference, reason) {
  try {
    const response = await axios.post(`${PAYSTACK_API}/transfer`, {
      source: 'balance',
      amount: amount,
      recipient: recipientCode,
      reference: reference,  // This ensures Paystack uses OUR reference
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