// src/apps/financial/services/withdrawal-sync.cron.js
import cron from 'node-cron';
import { UserModel } from '../../user/models/user/index.js';
import axios from 'axios';
//import { sendEmail } from "../../../services/email.service.js";
//import { withdrawalSuccessfulTemplate } from '../../wallet/services/email/withdrawalSuccessfulTemplate.js';
//import { withdrawalFailedTemplate } from '../../wallet/services/email/withdrawalFailedTemplate.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_API = 'https://api.paystack.co';
const BATCH_SIZE = 100; // Process 100 users at a time
const SYNC_INTERVAL = '*/30 * * * *'; // Every 30 minutes

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
 * Find users with processing withdrawals using aggregation with allowDiskUse
 */
async function findUsersWithProcessingWithdrawals() {
  console.log('🔍 Finding users with processing withdrawals...');
  
  const users = await UserModel.aggregate([
    {
      $match: {
        $or: [
          { 'wallets.promoter.transactions': { $elemMatch: { status: 'processing', category: 'withdrawal' } } },
          { 'wallets.marketer.transactions': { $elemMatch: { status: 'processing', category: 'withdrawal' } } },
          { 'wallets.promoter.transactions': { $elemMatch: { status: 'pending_approval', category: 'withdrawal' } } },
          { 'wallets.marketer.transactions': { $elemMatch: { status: 'pending_approval', category: 'withdrawal' } } }
        ]
      }
    },
    {
      $project: {
        _id: 1,
        uid: 1,
        username: 1,
        displayName: 1,
        email: 1,
        wallets: 1
      }
    }
  ], { allowDiskUse: true }); // THIS IS THE KEY FIX
  
  console.log(`✅ Found ${users.length} users with processing/pending withdrawals`);
  return users;
}

/**
 * Extract all processing withdrawals from a user
 */
function extractProcessingWithdrawals(user) {
  const withdrawals = [];
  
  // Check promoter wallet
  if (user.wallets?.promoter?.transactions) {
    const processingTxs = user.wallets.promoter.transactions.filter(
      tx => (tx.status === 'processing' || tx.status === 'pending_approval') && 
            tx.category === 'withdrawal'
    );
    
    processingTxs.forEach(tx => {
      withdrawals.push({
        user,
        transaction: tx,
        walletType: 'promoter',
        reference: tx.reference,
        providerReference: tx.providerReference,
        transferCode: tx.transferCode,
        amount: tx.amount,
        amountPayable: tx.amountPayable,
        createdAt: tx.createdAt
      });
    });
  }
  
  // Check marketer wallet
  if (user.wallets?.marketer?.transactions) {
    const processingTxs = user.wallets.marketer.transactions.filter(
      tx => (tx.status === 'processing' || tx.status === 'pending_approval') && 
            tx.category === 'withdrawal'
    );
    
    processingTxs.forEach(tx => {
      withdrawals.push({
        user,
        transaction: tx,
        walletType: 'marketer',
        reference: tx.reference,
        providerReference: tx.providerReference,
        transferCode: tx.transferCode,
        amount: tx.amount,
        amountPayable: tx.amountPayable,
        createdAt: tx.createdAt
      });
    });
  }
  
  return withdrawals;
}

/**
 * Check withdrawal status with Paystack
 */
async function checkWithdrawalStatus(withdrawal) {
  const { transaction, reference, providerReference, transferCode } = withdrawal;
  
  // Try multiple methods to get status
  let status = null;
  let paystackData = null;
  
  // Method 1: Use transfer code if available
  if (transferCode) {
    try {
      console.log(`   Checking status for transfer code: ${transferCode}`);
      const response = await axios.get(`${PAYSTACK_API}/transfer/${transferCode}`, {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`
        }
      });
      
      if (response.data.status) {
        status = response.data.data.status;
        paystackData = response.data.data;
        console.log(`   Status from transfer code: ${status}`);
      }
    } catch (error) {
      if (error.response?.status !== 404) {
        console.log(`   Error checking transfer code: ${error.message}`);
      }
    }
  }
  
  // Method 2: Use provider reference if available
  if (!status && providerReference) {
    try {
      console.log(`   Checking status for provider reference: ${providerReference}`);
      const response = await axios.get(`${PAYSTACK_API}/transfer/${providerReference}`, {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`
        }
      });
      
      if (response.data.status) {
        status = response.data.data.status;
        paystackData = response.data.data;
        console.log(`   Status from provider reference: ${status}`);
      }
    } catch (error) {
      if (error.response?.status !== 404) {
        console.log(`   Error checking provider reference: ${error.message}`);
      }
    }
  }
  
  // Method 3: Try to find by reference in our system
  if (!status && reference) {
    try {
      console.log(`   Attempting to find transfer by our reference: ${reference}`);
      
      // Paystack might have our reference in their system
      const response = await axios.get(`${PAYSTACK_API}/transfer`, {
        params: {
          reference: reference,
          perPage: 1
        },
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`
        }
      });
      
      if (response.data.status && response.data.data.length > 0) {
        const matchingTransfer = response.data.data[0];
        status = matchingTransfer.status;
        paystackData = matchingTransfer;
        console.log(`   Found transfer with our reference, status: ${status}`);
        
        // Update references
        transaction.providerReference = matchingTransfer.reference;
        transaction.transferCode = matchingTransfer.transfer_code;
      }
    } catch (error) {
      console.log(`   Error finding by reference: ${error.message}`);
    }
  }
  
  return { status, paystackData };
}

/**
 * Update transaction status based on Paystack response
 */
async function updateTransactionStatus(withdrawal, paystackStatus, paystackData) {
  const { user, transaction, walletType } = withdrawal;
  let updated = false;
  
  // Skip if transaction is less than 2 minutes old (avoid race conditions)
  const txAge = Date.now() - new Date(transaction.createdAt).getTime();
  if (txAge < 2 * 60 * 1000) {
    console.log(`   ⏭️ Skipping recent withdrawal (age: ${Math.round(txAge / 1000)}s)`);
    return false;
  }
  
  // Map Paystack status to our status
  switch (paystackStatus) {
    case 'success':
      if (transaction.status !== 'successful') {
        console.log(`   ✅ Marking as successful`);
        transaction.status = 'successful';
        transaction.processedAt = new Date();
        transaction.meta.syncUpdate = {
          syncedAt: new Date(),
          previousStatus: transaction.status,
          paystackData
        };
        updated = true;
        
        // Send success email if not already sent
        /* if (user.email && !transaction.meta.emailSent) {
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
            
            transaction.meta.emailSent = true;
          } catch (emailError) {
            console.error('   Failed to send success email:', emailError);
          }
        } */
      }
      break;
      
    case 'failed':
    case 'reversed':
      if (transaction.status !== 'failed' && transaction.status !== 'reversed') {
        console.log(`   ❌ Marking as ${paystackStatus}`);
        
        // Refund the user
        const wallet = user.wallets[walletType];
        wallet.balance += transaction.amount;
        
        transaction.status = paystackStatus === 'reversed' ? 'reversed' : 'failed';
        transaction.failureReason = paystackData?.reason || `Transfer ${paystackStatus} on Paystack`;
        transaction.processedAt = new Date();
        transaction.meta.syncUpdate = {
          syncedAt: new Date(),
          previousStatus: transaction.status,
          paystackData
        };
        updated = true;
        
        // Send failure email
       /*  if (user.email && !transaction.meta.emailSent) {
          try {
            const emailTemplate = withdrawalFailedTemplate(
              user.displayName || user.username,
              (transaction.amount / 100).toFixed(2),
              transaction.failureReason,
              new Date().toLocaleDateString()
            );
            
            await sendEmail({
              to: user.email,
              subject: 'Withdrawal Failed - Funds Refunded',
              html: emailTemplate
            });
            
            transaction.meta.emailSent = true;
          } catch (emailError) {
            console.error('   Failed to send failure email:', emailError);
          }
        } */
      }
      break;
    case 'rejected':
      if (transaction.status !== 'rejected') {
        console.log(`   ❌ Marking as ${paystackStatus}`);
        
        // Refund the user
        const wallet = user.wallets[walletType];
        wallet.balance += transaction.amount;
        
        transaction.status = 'rejected';
        transaction.failureReason = paystackData?.reason || `Transfer ${paystackStatus} on Paystack`;
        transaction.processedAt = new Date();
        transaction.meta.syncUpdate = {
          syncedAt: new Date(),
          previousStatus: transaction.status,
          paystackData
        };
        updated = true;      
      }
      break;
      
    case 'pending':
    case 'processing':
      if (transaction.status !== 'processing') {
        console.log(`   ⏳ Updating to processing`);
        transaction.status = 'processing';
        transaction.meta.syncUpdate = {
          syncedAt: new Date(),
          previousStatus: transaction.status,
          paystackData
        };
        updated = true;
      }
      break;
      
    default:
      console.log(`   Unknown status: ${paystackStatus}`);
  }
  
  return updated;
}

/**
 * Main sync function
 */
async function syncWithdrawalStatuses() {
  console.log('='.repeat(60));
  console.log('🔄 Starting withdrawal status sync at', new Date().toISOString());
  console.log('='.repeat(60));
  
  let syncedCount = 0;
  let errorCount = 0;
  let skippedCount = 0;
  
  try {
    // Get users with processing withdrawals (using aggregation with allowDiskUse)
    const users = await findUsersWithProcessingWithdrawals();
    
    if (users.length === 0) {
      console.log('📊 No users with processing withdrawals found');
      return { syncedCount: 0, errorCount: 0, skippedCount: 0 };
    }
    
    console.log(`📊 Processing ${users.length} users with pending withdrawals`);
    
    // Process users in batches
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batchUsers = users.slice(i, i + BATCH_SIZE);
      console.log(`\n📦 Processing user batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(users.length / BATCH_SIZE)}`);
      
      for (const user of batchUsers) {
        try {
          // Extract all processing withdrawals for this user
          const userWithdrawals = extractProcessingWithdrawals(user);
          
          if (userWithdrawals.length === 0) {
            continue;
          }
          
          console.log(`\n👤 User: ${user.displayName || user.username} (${user._id})`);
          console.log(`   Withdrawals to check: ${userWithdrawals.length}`);
          
          let userUpdated = false;
          
          for (const withdrawal of userWithdrawals) {
            console.log(`\n   🔍 Checking withdrawal: ${withdrawal.reference}`);
            console.log(`      Amount: ₦${(withdrawal.amount / 100).toFixed(2)}`);
            
            // Check status with Paystack
            const { status, paystackData } = await checkWithdrawalStatus(withdrawal);
            
            if (status) {
              console.log(`      Paystack Status: ${status}`);
              
              // Update transaction if needed
              const updated = await updateTransactionStatus(withdrawal, status, paystackData);
              
              if (updated) {
                syncedCount++;
                userUpdated = true;
                console.log(`      ✅ Transaction updated`);
              } else {
                console.log(`      ℹ️ No update needed`);
              }
            } else {
              console.log(`      ⚠️ Could not determine status from Paystack`);
              skippedCount++;
            }
            
            // Small delay between API calls to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          
          // Save user if any transactions were updated
          if (userUpdated) {
            if (user.wallets?.promoter) {
              cleanInvalidTransactionIds(user.wallets.promoter);
            }
            if (user.wallets?.marketer) {
              cleanInvalidTransactionIds(user.wallets.marketer);
            }
            
            // Use updateOne to save changes
            await UserModel.updateOne(
              { _id: user._id },
              { $set: { wallets: user.wallets } }
            );
            console.log(`   ✅ User saved`);
          }
          
        } catch (error) {
          console.error(`   ❌ Error processing user ${user._id}:`, error.message);
          errorCount++;
        }
      }
      
      // Delay between batches
      if (i + BATCH_SIZE < users.length) {
        console.log('⏳ Waiting 3 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Sync completed at', new Date().toISOString());
    console.log('📊 Summary:');
    console.log(`   - Synced: ${syncedCount}`);
    console.log(`   - Errors: ${errorCount}`);
    console.log(`   - Skipped: ${skippedCount}`);
    console.log('='.repeat(60));
    
    return { syncedCount, errorCount, skippedCount };
    
  } catch (error) {
    console.error('❌ Fatal error in sync job:', error);
    throw error;
  }
}

/**
 * Initialize the cron job
 */
export function initWithdrawalSyncCron() {
  console.log('⏰ Initializing withdrawal sync cron job (runs every 10 minutes)');
  
  // Schedule the job
  const task = cron.schedule(SYNC_INTERVAL, async () => {
    try {
      await syncWithdrawalStatuses();
    } catch (error) {
      console.error('❌ Withdrawal sync cron job failed:', error);
    }
  });
  
  // Run immediately on startup (with a small delay)
  setTimeout(() => {
    console.log('🚀 Running initial withdrawal sync...');
    syncWithdrawalStatuses().catch(console.error);
  }, 5000);
  
  return task;
}

/**
 * Manual sync endpoint for admin use
 */
/* export async function manualSyncWithdrawals(req, res) {
  try {
    const result = await syncWithdrawalStatuses();
    res.status(200).json({
      success: true,
      message: 'Withdrawal sync completed',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Sync failed',
      error: error.message
    });
  }
} */

/**
 * Get stuck withdrawals for admin review
 */
/* export async function getStuckWithdrawals(req, res) {
  try {
    const users = await UserModel.aggregate([
      {
        $match: {
          $or: [
            { 'wallets.promoter.transactions': { $elemMatch: { 'meta.stuck': true, category: 'withdrawal' } } },
            { 'wallets.marketer.transactions': { $elemMatch: { 'meta.stuck': true, category: 'withdrawal' } } }
          ]
        }
      },
      {
        $project: {
          _id: 1,
          uid: 1,
          username: 1,
          displayName: 1,
          email: 1,
          wallets: 1
        }
      }
    ], { allowDiskUse: true });
    
    const stuckWithdrawals = [];
    
    for (const user of users) {
      if (user.wallets?.promoter?.transactions) {
        user.wallets.promoter.transactions.forEach(tx => {
          if (tx.meta?.stuck && tx.category === 'withdrawal') {
            stuckWithdrawals.push({
              userId: user._id,
              userName: user.displayName || user.username,
              userEmail: user.email,
              transaction: {
                _id: tx._id,
                reference: tx.reference,
                amount: tx.amount,
                amountPayable: tx.amountPayable,
                status: tx.status,
                failureReason: tx.failureReason,
                createdAt: tx.createdAt,
                bankDetails: tx.bankDetails
              },
              walletType: 'promoter'
            });
          }
        });
      }
      
      if (user.wallets?.marketer?.transactions) {
        user.wallets.marketer.transactions.forEach(tx => {
          if (tx.meta?.stuck && tx.category === 'withdrawal') {
            stuckWithdrawals.push({
              userId: user._id,
              userName: user.displayName || user.username,
              userEmail: user.email,
              transaction: {
                _id: tx._id,
                reference: tx.reference,
                amount: tx.amount,
                amountPayable: tx.amountPayable,
                status: tx.status,
                failureReason: tx.failureReason,
                createdAt: tx.createdAt,
                bankDetails: tx.bankDetails
              },
              walletType: 'marketer'
            });
          }
        });
      }
    }
    
    res.status(200).json({
      success: true,
      data: stuckWithdrawals
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get stuck withdrawals',
      error: error.message
    });
  }
} */