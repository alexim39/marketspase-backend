import { UserModel} from '../../user/models/user.model.js';
import { sendEmail } from "../../../services/email.service.js";
import { paymentDeclinedEmailTemplate } from '../services/email/paymentDeclinedTemplate.js';
import { paymentApprovedEmailTemplate } from '../services/email/paymentApprovedTemplate.js';
import mongoose from 'mongoose';
import axios from 'axios';
// server.js or index.js
import dotenv from 'dotenv';
dotenv.config();

// import referral service for paying referred marketer
import { ReferralService } from './../../user/services/referral.service.js';
const referralService = new ReferralService();

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

  //console.log('Reference being sent to Paystack:', reference);
  //console.log('Paystack:', paystackResult.response);

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
      // Get user for email before sending error
      const userForEmail = await UserModel.findById(userId);
      if (userForEmail) {
        try {
          const emailContent = paymentDeclinedEmailTemplate({
            userName: userForEmail.displayName,
            amount: amount,
            transactionReference: reference,
            reason: 'Paystack verification failed or transaction was not successful.',
          });
          await sendEmail(userForEmail.email, 'Payment Declined', emailContent);
        } catch (emailError) {
          console.error('Failed to send declined email:', emailError);
        }
      }

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
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Check if this is the user's first campaign funding
      const isFirstCampaignFunding = !user.qualificationMilestones.firstCampaignFunded;
      
      // Update user wallet and transaction
      const updatedUser = await UserModel.findByIdAndUpdate(
        userId,
        {
          $inc: { 
            'wallets.marketer.balance': amount 
          },
          $push: {
            'wallets.marketer.transactions': {
              amount: amount,
              type: 'credit',
              category: 'deposit',
              description: `Paystack funding: ${reference}`,
              status: 'successful',
              createdAt: new Date()
            }
          },
          // Conditionally set firstCampaignFunded if this is the first time
          ...(isFirstCampaignFunding && {
            $set: {
              'qualificationMilestones.firstCampaignFunded': true
            }
          })
        },
        { 
          session, 
          new: true // Return the updated document
        }
      );

      // Commit the transaction
      await session.commitTransaction();
      session.endSession();

      // Check for referral bonus AFTER successful transaction
      // if (isFirstCampaignFunding) {
      //   console.log(`First campaign funding detected for user: ${userId}`);
      //   await referralService.checkMarketerFirstCampaign(userId);
      // }

      // Check for referral bonus AFTER successful transaction
      if (isFirstCampaignFunding) {
        console.log(`First campaign funding detected for user: ${userId}`);
        
        // Ensure the referral bonus is only processed if the amount is N2000 or more (2000)
        const MINIMUM_REFERRAL_AMOUNT = 2000;
        
        if (amount >= MINIMUM_REFERRAL_AMOUNT) {
            console.log(`Funding amount (${amount}) meets the minimum referral requirement (${MINIMUM_REFERRAL_AMOUNT}). Checking for referrer...`);
            await referralService.checkMarketerFirstCampaign(userId);
        } else {
            console.log(`Funding amount (${amount}) is below the minimum referral requirement of N${MINIMUM_REFERRAL_AMOUNT}. Referral bonus skipped.`);
        }
      }

      // 6. Respond to Frontend
      res.status(200).json({
        success: true,
        message: 'Payment verified and wallet successfully funded.',
        newBalance: updatedUser.wallets.marketer.balance,
        transactionId: updatedUser.wallets.marketer.transactions[updatedUser.wallets.marketer.transactions.length - 1]._id,
        isFirstCampaignFunding: isFirstCampaignFunding
      });

      // Send approved email to the user
      try {
        const emailContent = paymentApprovedEmailTemplate({
          userName: updatedUser.displayName,
          amount: amount,
          transactionReference: reference,
          newBalance: updatedUser.wallets.marketer.balance,
        });
        await sendEmail(updatedUser.email, 'Payment Approved', emailContent);
      } catch (emailError) {
        console.error('Failed to send approved email:', emailError);
      }

    } catch (transactionError) {
      // Abort the transaction in case of any error
      await session.abortTransaction();
      session.endSession();

      // Send declined email to the user
      try {
        const userForEmail = await UserModel.findById(userId);
        if (userForEmail) {
          const emailContent = paymentDeclinedEmailTemplate({
            userName: userForEmail.displayName,
            amount: amount,
            transactionReference: reference,
            reason: 'Failed to update wallet and record transaction due to a database error.',
          });
          await sendEmail(userForEmail.email, 'Payment Declined', emailContent);
        }
      } catch (emailError) {
        console.error('Failed to send declined email:', emailError);
      }

      sendError(res, 'Failed to update wallet and record transaction due to a database error.', 500);
    }

  } catch (paystackError) {
    // Handle specific HTTP status codes from Paystack or other network errors
    const errorMessage = paystackError.response?.data?.message || 'Paystack verification failed.';
    return sendError(res, `Verification Error: ${errorMessage}`, 500);
  }
};