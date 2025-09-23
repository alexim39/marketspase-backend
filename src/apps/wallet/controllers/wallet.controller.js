import { UserModel} from '../../user/models/user.model.js';
import { sendEmail } from "../../../services/emailService.js";
import { ownerWalletEmailTemplate } from '../services/email/ownerTemplate.js';
import { userWalletEmailTemplate } from '../services/email/userTemplate.js';
import mongoose from 'mongoose';
import axios from 'axios';
// server.js or index.js
import dotenv from 'dotenv';
dotenv.config();

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
      'wallets.marketer.transactions.description': `Paystack funding: ${reference}`
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
      // Find the user and update their marketer wallet balance
      // Since the frontend payload shows `marketer` wallet, we'll assume that's the one to fund.
      user.wallets.marketer.balance += amount; 

      // Create the new transaction object based on your schema
      const newTransaction = {
        amount: amount,
        type: 'credit',
        category: 'deposit',
        description: `Paystack funding: ${reference}`,
        status: 'successful',
        createdAt: new Date()
      };

      // Push the new transaction to the marketer's wallet
      user.wallets.marketer.transactions.push(newTransaction);

      // Save the user document within the session
      await user.save({ session });
      
      // Commit the transaction
      await session.commitTransaction();
      session.endSession();

      // 6. Respond to Frontend
      res.status(200).json({
        success: true,
        message: 'Payment verified and wallet successfully funded.',
        newBalance: user.wallets.marketer.balance,
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