// api/webhook/paystack/approval.js (or appropriate path for your framework)
import { UserModel } from '../../user/models/user.model.js';
import { sendEmail } from "../../../services/email.service.js";
import { withdrawalSuccessfulTemplate } from './email/withdrawalSuccessfulTemplate.js';
import { withdrawalFailedTemplate } from './email/withdrawalFailedTemplate.js';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const PAYSTACK_SECRET_KEY = 'sk_live_31139039a3e109121ff97248e06ee567563cede4';

/**
 * Verify Paystack webhook signature - MORE ROBUST VERSION
 */
function verifyWebhookSignature(signature, body, rawBody) {
  if (!signature) {
    console.error('No signature provided');
    return false;
  }

  try {
    // Use rawBody if available, otherwise stringify the parsed body
    const bodyToSign = rawBody || JSON.stringify(body);
    
    const hash = crypto
      .createHmac('sha512', PAYSTACK_SECRET_KEY)
      .update(bodyToSign)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(hash, 'hex'),
      Buffer.from(signature, 'hex')
    );
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

/**
 * Clean invalid ObjectIds in embedded transactions
 */
const cleanInvalidTransactionIds = (wallet) => {
  if (!wallet || !Array.isArray(wallet.transactions)) return;
  wallet.transactions = wallet.transactions.map((tx) => {
    try {
      if (tx._id && !mongoose.isValidObjectId(tx._id)) {
        tx._id = new mongoose.Types.ObjectId();
      }
    } catch {
      tx._id = new mongoose.Types.ObjectId();
    }
    return tx;
  });
};

/**
 * Find transaction by reference across all users - MORE ROBUST VERSION
 */
async function findTransactionByReference(reference) {
  console.log('Searching for transaction with reference:', reference);
  
  // Search in promoter wallet transactions
  const user = await UserModel.findOne({
    $or: [
      { 'wallets.promoter.transactions.reference': reference },
      { 'wallets.promoter.transactions.providerReference': reference }, // Also search by providerReference
      { 'wallets.marketer.transactions.reference': reference },
      { 'wallets.marketer.transactions.providerReference': reference }
    ]
  });

  if (!user) {
    console.log('No user found with reference:', reference);
    return { user: null, transaction: null, walletType: null };
  }

  console.log('Found user:', user._id);

  // Check promoter wallet
  let transaction = user.wallets.promoter?.transactions.find(tx => 
    tx.reference === reference || tx.providerReference === reference
  );
  
  if (transaction) {
    console.log('Found transaction in promoter wallet:', transaction._id);
    return { user, transaction, walletType: 'promoter' };
  }

  // Check marketer wallet
  transaction = user.wallets.marketer?.transactions.find(tx => 
    tx.reference === reference || tx.providerReference === reference
  );
  
  if (transaction) {
    console.log('Found transaction in marketer wallet:', transaction._id);
    return { user, transaction, walletType: 'marketer' };
  }

  console.log('Transaction not found in either wallet');
  return { user: null, transaction: null, walletType: null };
}

export default async function handler(req, res) {

   // Get signature from header
  const signature = req.headers['x-paystack-signature'];
  
  // Use rawBody if available (from server.js verification)
  const rawBody = req.rawBody;
  
  // Verify webhook signature
  if (!signature || !verifyWebhookSignature(signature, req.body, rawBody)) {
    console.error('Invalid webhook signature');
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Invalid signature'
    });
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Log headers for debugging (remove in production)
  console.log('Webhook headers:', {
    signature: req.headers['x-paystack-signature']?.substring(0, 20) + '...',
    contentType: req.headers['content-type'],
    userAgent: req.headers['user-agent']
  });

  const event = req.body;
  console.log('✅ Webhook signature verified successfully');
  console.log('Received Paystack webhook:', event.event, event.data?.reference);

  try {
    // Handle transfer events
    switch (event.event) {
      case 'transfer.success':
        await handleTransferSuccess(event.data);
        break;
      
      case 'transfer.failed':
        await handleTransferFailed(event.data);
        break;
      
      case 'transfer.reversed':
        await handleTransferReversed(event.data);
        break;
      
      default:
        console.log(`Unhandled event type: ${event.event}`);
    }

    return res.status(200).json({ status: 'success' });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Handle successful transfer
 */
async function handleTransferSuccess(data) {
  const { reference, amount, transfer_code, reason, createdAt } = data;

   console.log('Processing transfer.success with data:', {
    webhookReference: reference,
    transfer_code,
    amount
  });

  const { user, transaction, walletType } = await findTransactionByReference(reference);

  console.log('Lookup result:', { 
    found: !!user, 
    transactionId: transaction?._id,
    transactionRef: transaction?.reference,
    providerRef: transaction?.providerReference 
  });

 
  if (!user || !transaction) {
    console.error(`Transaction not found for reference: ${reference}`);
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
      'withdrawal_completed',
      `Withdrawal of ₦${(transaction.amount / 100).toFixed(2)} completed successfully`,
      {
        resourceType: 'withdrawal',
        metadata: {
          transactionId: transaction._id,
          reference: reference,
          amount: transaction.amount
        }
      }
    );
  }

  // Send success email
  if (user.email) {
    try {
      const emailTemplate = withdrawalSuccessfulTemplate(
        user.displayName || user.username,
        (transaction.amount / 100).toFixed(2),
        transaction.bankDetails?.accountNumber?.slice(-4) || '****',
        transaction.bankDetails?.bank || 'your bank',
        new Date().toLocaleDateString()
      );

      await sendEmail({
        to: user.email,
        subject: 'Withdrawal Successful',
        html: emailTemplate
      });
    } catch (emailError) {
      console.error('Failed to send success email:', emailError);
    }
  }

  cleanInvalidTransactionIds(user.wallets[walletType]);
  await user.save();
  console.log(`✅ Withdrawal successful for reference: ${reference}`);
}

/**
 * Handle failed transfer
 */
async function handleTransferFailed(data) {
  const { reference, amount, transfer_code, reason, createdAt } = data;

  const { user, transaction, walletType } = await findTransactionByReference(reference);

  if (!user || !transaction) {
    console.error(`Transaction not found for reference: ${reference}`);
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
      'withdrawal_failed',
      `Withdrawal of ₦${(transaction.amount / 100).toFixed(2)} failed. Amount refunded.`,
      {
        resourceType: 'withdrawal',
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
  if (user.email) {
    try {
      const emailTemplate = withdrawalFailedTemplate(
        user.displayName || user.username,
        (transaction.amount / 100).toFixed(2),
        reason || 'Unknown error',
        new Date().toLocaleDateString()
      );

      await sendEmail({
        to: user.email,
        subject: 'Withdrawal Failed - Funds Refunded',
        html: emailTemplate
      });
    } catch (emailError) {
      console.error('Failed to send failure email:', emailError);
    }
  }

  cleanInvalidTransactionIds(wallet);
  await user.save();
  console.log(`❌ Withdrawal failed and refunded for reference: ${reference}`);
}

/**
 * Handle reversed transfer
 */
async function handleTransferReversed(data) {
  const { reference, amount, transfer_code, reason, createdAt } = data;

  const { user, transaction, walletType } = await findTransactionByReference(reference);

  if (!user || !transaction) {
    console.error(`Transaction not found for reference: ${reference}`);
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
      'withdrawal_reversed',
      `Withdrawal of ₦${(transaction.amount / 100).toFixed(2)} was reversed. Amount refunded.`,
      {
        resourceType: 'withdrawal',
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
  console.log(`↩️ Withdrawal reversed for reference: ${reference}`);
}