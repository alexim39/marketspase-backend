// api/webhook/paystack/approval.js
import { UserModel } from '../../user/models/user/index.js';
import { sendEmail } from "../../../core/email.service.js";
import { withdrawalSuccessfulTemplate } from './email/withdrawalSuccessfulTemplate.js';
import { withdrawalFailedTemplate } from './email/withdrawalFailedTemplate.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_API = 'https://api.paystack.co';

export default async function handler(req, res) {
  // FIRST: Check if it's a POST request
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('='.repeat(80));
  console.log('🔥 WEBHOOK RECEIVED AT:', new Date().toISOString());
  console.log('Event type:', req.body?.event);
  console.log('='.repeat(80));

  const event = req.body;

  try {
    // Handle transferrequest.approval-required (this is what you're getting)
    if (event.event === 'transferrequest.approval-required') {
      console.log('⚠️ Transfer requires approval - processing...');
      
      // The transfer data is in event.data
      const transferData = event.data;
      
      // Extract the reference
      let reference = null;
      let transferCode = null;
      
      // Check where the reference is
      if (transferData.reference) {
        reference = transferData.reference;
        console.log('Found reference in data.reference:', reference);
      }
      
      if (transferData.transfer_code) {
        transferCode = transferData.transfer_code;
        console.log('Found transfer_code:', transferCode);
      }
      
      if (reference) {
        // Try to find the transaction
        const { user, transaction, walletType } = await findTransactionByReference(reference);
        
        if (user && transaction) {
          console.log('✅ Found transaction, updating status to pending_approval');
          
          // Update transaction status
          transaction.status = 'pending_approval';
          transaction.transferCode = transferCode;
          transaction.meta.approvalRequired = true;
          transaction.meta.webhook = {
            event: event.event,
            receivedAt: new Date(),
            data: transferData
          };
          
          cleanInvalidTransactionIds(user.wallets[walletType]);
          await user.save();
          console.log('✅ Transaction updated successfully');
          
          // OPTIONAL: Auto-approve the transfer via API
          try {
            console.log('Attempting to auto-approve transfer...');
            
            // Fetch the transfer to confirm
            const transferResponse = await axios.get(
              `${PAYSTACK_API}/transfer/${transferCode}`,
              {
                headers: {
                  Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`
                }
              }
            );
            
            console.log('Transfer status:', transferResponse.data.data.status);
            
            // If transfer is still pending, we could auto-approve
            // But note: This requires special API permissions
            // For now, we'll just log it
            
          } catch (apiError) {
            console.log('Could not auto-approve (manual approval needed):', apiError.message);
          }
          
        } else {
          console.log('❌ Transaction not found for reference:', reference);
        }
      }
      
      // Always return success to Paystack
      return res.status(200).json({ 
        status: 'success',
        message: 'Approval required event processed'
      });
    }
    
    // Handle successful transfer (when it's finally approved)
    if (event.event === 'transfer.success') {
      await handleTransferSuccess(event.data);
    }
    
    // Handle failed transfer
    if (event.event === 'transfer.failed') {
      await handleTransferFailed(event.data);
    }
    
    // Handle reversed transfer
    if (event.event === 'transfer.reversed') {
      await handleTransferReversed(event.data);
    }

    return res.status(200).json({ status: 'success' });

  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Clean invalid ObjectIds in embedded transactions
 */
const cleanInvalidTransactionIds = (wallet) => {
  if (!wallet || !Array.isArray(wallet.transactions)) return;
  wallet.transactions = wallet.transactions.map((tx) => {
    try {
      if (tx._id && !mongoose.Types.ObjectId.isValid(tx._id)) {
        tx._id = new mongoose.Types.ObjectId();
      }
    } catch {
      tx._id = new mongoose.Types.ObjectId();
    }
    return tx;
  });
};

/**
 * Find transaction by reference across all users
 */
async function findTransactionByReference(reference) {
  console.log('🔍 Searching for transaction with reference:', reference);
  
  const user = await UserModel.findOne({
    $or: [
      { 'wallets.promoter.transactions.reference': reference },
      { 'wallets.promoter.transactions.providerReference': reference },
      { 'wallets.marketer.transactions.reference': reference },
      { 'wallets.marketer.transactions.providerReference': reference }
    ]
  });

  if (!user) {
    console.log('❌ No user found');
    return { user: null, transaction: null, walletType: null };
  }

  // Check promoter wallet
  let transaction = user.wallets.promoter?.transactions.find(tx => 
    tx.reference === reference || tx.providerReference === reference
  );
  
  if (transaction) {
    console.log('✅ Found in promoter wallet');
    return { user, transaction, walletType: 'promoter' };
  }

  // Check marketer wallet
  transaction = user.wallets.marketer?.transactions.find(tx => 
    tx.reference === reference || tx.providerReference === reference
  );
  
  if (transaction) {
    console.log('✅ Found in marketer wallet');
    return { user, transaction, walletType: 'marketer' };
  }

  console.log('❌ Transaction not found');
  return { user: null, transaction: null, walletType: null };
}

/**
 * Handle successful transfer
 */
async function handleTransferSuccess(data) {
  const { reference, amount, transfer_code } = data;

  console.log('💰 Processing transfer.success:', { reference, transfer_code, amount });

  const { user, transaction, walletType } = await findTransactionByReference(reference);

  if (!user || !transaction) {
    console.error(`❌ Transaction not found for reference: ${reference}`);
    return;
  }

  // Update transaction status
  transaction.status = 'successful';
  transaction.processedAt = new Date();
  transaction.providerReference = transfer_code;
  transaction.meta.webhook = {
    event: 'transfer.success',
    receivedAt: new Date(),
    data: data
  };

  // Add to activity log
  if (user.logActivity) {
    await user.logActivity(
      'withdrawal_complete',
      `Withdrawal of ₦${(transaction.amount / 100).toFixed(2)} completed successfully`,
      {
        resourceType: 'wallet',
        metadata: {
          transactionId: transaction._id,
          reference: reference,
          amount: transaction.amount
        }
      }
    );
  }

  // Send success email
  // if (user.email) {
  //   try {
  //     const emailTemplate = withdrawalSuccessfulTemplate(
  //       user.displayName || user.username,
  //       (transaction.amount / 100).toFixed(2),
  //       transaction.bankDetails?.accountNumber?.slice(-4) || '****',
  //       transaction.bankDetails?.bank || 'your bank',
  //       new Date().toLocaleDateString()
  //     );

  //     await sendEmail({
  //       to: user.email,
  //       subject: 'Withdrawal Successful',
  //       html: emailTemplate
  //     });
  //   } catch (emailError) {
  //     console.error('Failed to send success email:', emailError);
  //   }
  // }

  cleanInvalidTransactionIds(user.wallets[walletType]);
  await user.save();
  console.log(`✅ Withdrawal successful for reference: ${reference}`);
}

/**
 * Handle failed transfer
 */
async function handleTransferFailed(data) {
  const { reference, amount, transfer_code, reason } = data;

  console.log('❌ Processing transfer.failed:', { reference, transfer_code, reason });

  const { user, transaction, walletType } = await findTransactionByReference(reference);

  if (!user || !transaction) {
    console.error(`❌ Transaction not found for reference: ${reference}`);
    return;
  }

  const wallet = user.wallets[walletType];

  // REFUND: Add the gross amount back to balance
  wallet.balance += transaction.amount;

  // Update transaction status
  transaction.status = 'failed';
  transaction.failureReason = reason || 'Transfer failed';
  transaction.processedAt = new Date();
  transaction.meta.webhook = {
    event: 'transfer.failed',
    receivedAt: new Date(),
    data: data
  };

  // Add to activity log
  if (user.logActivity) {
    await user.logActivity(
      'withdrawal_rejected',
      `Withdrawal of ₦${(transaction.amount / 100).toFixed(2)} failed. Amount refunded.`,
      {
        resourceType: 'wallet',
        metadata: {
          transactionId: transaction._id,
          reference: reference,
          amount: transaction.amount,
          failureReason: reason
        }
      }
    );
  }

  // Send failure email
  // if (user.email) {
  //   try {
  //     const emailTemplate = withdrawalFailedTemplate(
  //       user.displayName || user.username,
  //       (transaction.amount / 100).toFixed(2),
  //       reason || 'Unknown error',
  //       new Date().toLocaleDateString()
  //     );

  //     await sendEmail({
  //       to: user.email,
  //       subject: 'Withdrawal Failed - Funds Refunded',
  //       html: emailTemplate
  //     });
  //   } catch (emailError) {
  //     console.error('Failed to send failure email:', emailError);
  //   }
  // }

  cleanInvalidTransactionIds(wallet);
  await user.save();
  console.log(`✅ Refunded and marked failed for reference: ${reference}`);
}

/**
 * Handle reversed transfer
 */
async function handleTransferReversed(data) {
  const { reference, amount, transfer_code, reason } = data;

  console.log('↩️ Processing transfer.reversed:', { reference, transfer_code, reason });

  const { user, transaction, walletType } = await findTransactionByReference(reference);

  if (!user || !transaction) {
    console.error(`❌ Transaction not found for reference: ${reference}`);
    return;
  }

  const wallet = user.wallets[walletType];

  // Only refund if not already refunded
  if (transaction.status !== 'failed' && transaction.status !== 'reversed') {
    wallet.balance += transaction.amount;
  }

  transaction.status = 'reversed';
  transaction.failureReason = reason || 'Transfer reversed';
  transaction.processedAt = new Date();
  transaction.meta.webhook = {
    event: 'transfer.reversed',
    receivedAt: new Date(),
    data: data
  };

  if (user.logActivity) {
    await user.logActivity(
      'withdrawal_rejected',
      `Withdrawal of ₦${(transaction.amount / 100).toFixed(2)} was reversed. Amount refunded.`,
      {
        resourceType: 'wallet',
        metadata: {
          transactionId: transaction._id,
          reference: reference,
          amount: transaction.amount,
          failureReason: reason
        }
      }
    );
  }

  cleanInvalidTransactionIds(wallet);
  await user.save();
  console.log(`✅ Reversed and refunded for reference: ${reference}`);
}