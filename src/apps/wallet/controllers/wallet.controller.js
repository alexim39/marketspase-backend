import { UserModel} from '../../user/models/user.model.js';
import { sendEmail } from "../../../services/emailService.js";
import { ownerWalletEmailTemplate } from '../services/email/ownerTemplate.js';
import { userWalletEmailTemplate } from '../services/email/userTemplate.js';
import mongoose from 'mongoose';
import axios from 'axios';
// server.js or index.js
import dotenv from 'dotenv';
dotenv.config();
import {processPayment } from '../services/process-payment.js'

// Set up Paystack configuration from environment variables
const PAYSTACK_SECRET_KEY = process.env.PAYSTACKTOKEN;
const PAYSTACK_VERIFY_URL = 'https://api.paystack.co/transaction/verify/';

// Helper function for sending a consistent error response
const sendError = (res, message, status = 500) => {
  console.error(`Error: ${message}`);
  res.status(status).json({ success: false, message });
};

export const verifyAndRecordPayment = async (req, res) => {
  const { userId, amount, paystackResult } = req.body;
  
  // 1. Basic Payload Validation
  // Ensure we have the critical data points
  if (!userId || !amount || !paystackResult || !paystackResult.response || !paystackResult.response.reference) {
    return sendError(res, 'Invalid payload: missing userId, amount, or transaction reference.', 400);
  }

  const { reference } = paystackResult.response;

  // 2. Prevent Double-Processing
  // Check if a transaction with this reference already exists in the database
  try {
    const existingUser = await UserModel.findOne({
      'wallets.advertiser.transactions.description': `Paystack funding: ${reference}`
    });

    if (existingUser) {
      // The transaction is already recorded. This is likely a retry.
      // We can return a success response to the client to prevent them from retrying.
      return res.status(200).json({ 
        success: true, 
        message: 'Payment already recorded. No action needed.',
        alreadyExists: true 
      });
    }
  } catch (dbError) {
    return sendError(res, 'Failed to check for existing transaction.', 500);
  }

  // 3. Server-Side Verification with Paystack
  try {
    const response = await axios.get(`${PAYSTACK_VERIFY_URL}${reference}`, {
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const paystackVerificationData = response.data.data;
    if (!paystackVerificationData || paystackVerificationData.status !== 'success') {
        return sendError(res, 'Paystack verification failed or transaction not successful.', 400);
    }
    
    // Also, ensure the user ID sent from the frontend matches the user ID in the database.
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return sendError(res, 'Invalid user ID format.', 400);
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      return sendError(res, 'User not found.', 404);
    }

    // 5. Database Transaction and Atomic Update
    // Mongoose transactions ensure both the balance update and transaction record are successful or none are.
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Find the user and update their advertiser wallet balance
      // Since the frontend payload shows `advertiser` wallet, we'll assume that's the one to fund.
      user.wallets.advertiser.balance += amount; 

      // Create the new transaction object based on your schema
      const newTransaction = {
        amount: amount,
        type: 'credit',
        category: 'deposit',
        description: `Paystack funding: ${reference}`,
        status: 'successful',
        createdAt: new Date()
      };

      // Push the new transaction to the advertiser's wallet
      user.wallets.advertiser.transactions.push(newTransaction);

      // Save the user document within the session
      await user.save({ session });
      
      // Commit the transaction
      await session.commitTransaction();
      session.endSession();

      // 6. Respond to Frontend
      res.status(200).json({
        success: true,
        message: 'Payment verified and wallet successfully funded.',
        newBalance: user.wallets.advertiser.balance,
        transactionId: newTransaction._id // Mongoose automatically adds _id for subdocuments
      });

    } catch (transactionError) {
      // Abort the transaction in case of any error
      await session.abortTransaction();
      session.endSession();
      sendError(res, 'Failed to update wallet and record transaction due to a database error.', 500);
    }

  } catch (paystackError) {
    // Handle specific HTTP status codes from Paystack or other network errors
    const errorMessage = paystackError.response?.data?.message || 'Paystack verification failed.';
    return sendError(res, `Verification Error: ${errorMessage}`, 500);
  }
};


// User withdrawal request
export const withdrawRequest = async (req, res) => {
    const { bank, accountNumber, accountName, amount, userId, saveAccount, bankName } = req.body;

    // Use a single session for the entire operation to ensure atomicity
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // --- 1. Input and User Validation ---
        if (!userId || !amount || !bank || !accountNumber || !accountName) {
            await session.abortTransaction();
            return res.status(400).json({
                message: "Missing required fields.",
                success: false,
            });
        }

        const withdrawalAmount = Number(amount);
        if (isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
            await session.abortTransaction();
            return res.status(400).json({
                message: "Invalid withdrawal amount.",
                success: false,
            });
        }
        
        // Find the user by ID within the transaction
        const user = await UserModel.findById(userId).session(session);

        if (!user) {
            await session.abortTransaction();
            return res.status(404).json({
                message: "User not found",
                success: false,
            });
        }
        
        const promoterWallet = user.wallets.promoter;

        // --- 2. Calculate Fee and Total Deduction ---
        const WITHDRAWAL_FEE_RATE = 0.015;
        const WITHDRAWAL_FLAT_FEE = 100;
        const withdrawalFee = Math.max(withdrawalAmount * WITHDRAWAL_FEE_RATE, WITHDRAWAL_FLAT_FEE);
        const totalDeduction = withdrawalAmount + withdrawalFee;

        // Check for sufficient balance
        if (promoterWallet.balance < totalDeduction) {
            await session.abortTransaction();
            return res.status(400).json({
                message: "Insufficient balance for transaction. Your balance must cover the withdrawal amount and the service fee.",
                success: false,
            });
        }

        // --- 3. Initial State Change (Deduction & Pending Transaction) ---
        // Deduct the total amount (withdrawal + fee) from the user's balance
        promoterWallet.balance -= totalDeduction;
        
        // Create a new pending transaction record
        const newTransaction = {
            amount: withdrawalAmount, // This is the amount the user requested to withdraw
            fee: withdrawalFee, // Store the fee charged
            totalDeduction: totalDeduction, // Store the total amount deducted
            type: 'debit',
            category: 'withdrawal',
            description: `Withdrawal to ${bankName} account ending in ${accountNumber.slice(-4)}`,
            status: 'pending',
            createdAt: new Date(),
        };
        promoterWallet.transactions.push(newTransaction);
        
        // --- 4. Process External Payment ---
        // The `processPayment` function should only be passed the user's requested amount, not the fee.
        const paymentResponse = await processPayment(bank, accountNumber, accountName, withdrawalAmount);

        // --- 5. Update Database based on Payment Response ---
        // Find the transaction record we just created.
        const transactionToUpdate = promoterWallet.transactions[promoterWallet.transactions.length - 1];
        
        if (paymentResponse.success) {
            // Update transaction status
            transactionToUpdate.status = "successful";
            
            // Add account to saved accounts if requested
            if (saveAccount) {
                const existingAccount = user.savedAccounts.find(
                    (account) => account.accountNumber === accountNumber
                );

                if (!existingAccount) {
                    user.savedAccounts.push({
                        bank: bankName,
                        bankCode: bank,
                        accountNumber: accountNumber,
                        accountName: accountName,
                    });
                }
            }

            // Save the entire user document within the transaction
            await user.save({ session });
            await session.commitTransaction();
            
            return res.status(200).json({
                message: "Withdrawal successful, payment has been processed.",
                success: true,
                data: {
                    balance: promoterWallet.balance,
                    transaction: transactionToUpdate,
                },
            });

        } else {
            // Payment failed: refund the total deduction (amount + fee)
            transactionToUpdate.status = "failed";
            promoterWallet.balance += totalDeduction;

            // Save the user document with the refunded balance and failed status
            await user.save({ session });
            await session.commitTransaction();
            
            return res.status(500).json({
                message: "Payment failed. Your balance has been refunded.",
                success: false,
            });
        }
    } catch (error) {
        // In case of any error (DB or external API), abort the transaction
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        console.error("Error during withdrawal request:", error);
        res.status(500).json({
            message: "An unexpected error occurred.",
            success: false,
        });
    } finally {
        session.endSession();
    }
};


// Delete saved accounts
export const deleteSavedAccount = async (req, res) => {
    try {
        const { userId, accountNumber } = req.params;

        if (!userId || !accountNumber) {
            return res.status(400).json({ success: false, message: 'User ID and Account ID are required.' });
        }

        // Find the user by ID
        const user = await UserModel.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Find the index of the account to delete
        const accountIndex = user.savedAccounts.findIndex(
            (account) => account.accountNumber.toString() === accountNumber
        );

        if (accountIndex === -1) {
            return res.status(404).json({ success: false, message: 'Saved account not found' });
        }

        // Remove the account from the savedAccounts array
        user.savedAccounts.splice(accountIndex, 1);

        // Save the updated user document
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Saved account deleted successfully',
            data: user.savedAccounts,
        });
    } catch (error) {
        console.error('Error deleting saved account:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while deleting the saved account',
        });
    }
};