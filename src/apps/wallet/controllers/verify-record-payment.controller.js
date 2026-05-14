import { UserModel} from '../../user/models/user/index.js';
import { sendEmail } from "../../../core/email.service.js";
import { paymentDeclinedEmailTemplate } from '../services/email/paymentDeclinedTemplate.js';
import { paymentApprovedEmailTemplate } from '../services/email/paymentApprovedTemplate.js';
import mongoose from 'mongoose';
import axios from 'axios';
// server.js or index.js
import dotenv from 'dotenv';
dotenv.config();
import {
  buildSignedQuote,
  normalizeCurrencyCode,
  roundCurrencyAmount,
  verifySignedQuote,
} from '../services/payment-currency.service.js';
import { applyWalletCredit, ensureWalletCurrencyState } from '../services/wallet-ledger.service.js';

// import referral service for paying referred marketer
import { ReferralService } from './../../user/services/referral.service.js';
const referralService = new ReferralService();

// Set up Paystack configuration from environment variables
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_VERIFY_URL = 'https://api.paystack.co/transaction/verify/';

// Helper function for sending a consistent error response
const sendError = (res, message, status = 500) => {
  console.error(`Error: ${message}`);
  res.status(status).json({ success: false, message });
};

export const verifyAndRecordPayment = async (req, res) => {
  const userId = req.userId;
  const {
    amount,
    currency,
    paystackResult,
    quote,
  } = req.body;
  
  // 1. Basic Payload Validation
  if (!userId || !amount || !paystackResult?.response?.reference) {
    return sendError(res, 'Invalid payload: missing required fields.', 400);
  }

  const { reference } = paystackResult.response;

  // 2. Start MongoDB session for transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 3. Check for existing transaction using the reference field (more reliable)
    const existingUserWithTransaction = await UserModel.findOne({
      $or: [
        { 'wallets.marketer.transactions.reference': reference },
        { 'wallets.promoter.transactions.reference': reference }
      ]
    }).session(session);

    if (existingUserWithTransaction) {
      // Transaction already processed - return success to prevent double-charging
      await session.abortTransaction();
      session.endSession();
      
      return res.status(200).json({ 
        success: true, 
        message: 'Payment already recorded.',
        alreadyExists: true,
        newBalance: existingUserWithTransaction.wallets.marketer?.balance
      });
    }

    // 4. Verify with Paystack
    const paystackResponse = await axios.get(`${PAYSTACK_VERIFY_URL}${reference}`, {
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const verificationData = paystackResponse.data.data;
    
    if (!verificationData || verificationData.status !== 'success') {
      await session.abortTransaction();
      session.endSession();
      return sendError(res, 'Paystack verification failed.', 400);
    }

    // 5. Verify amount matches (prevent tampering)
    const fundingCurrency = normalizeCurrencyCode(currency || verificationData.currency || 'NGN');
    const paystackAmount = roundCurrencyAmount((verificationData.amount || 0) / 100);
    if (normalizeCurrencyCode(verificationData.currency || fundingCurrency) !== fundingCurrency) {
      await session.abortTransaction();
      session.endSession();
      return sendError(res, 'Currency mismatch with Paystack record.', 400);
    }

    if (Math.abs(paystackAmount - Number(amount)) > 1) {
      await session.abortTransaction();
      session.endSession();
      return sendError(res, 'Amount mismatch with Paystack record.', 400);
    }

    // 6. Find user and update
    const user = await UserModel.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return sendError(res, 'User not found.', 404);
    }

    // 7. Check if this is first campaign funding
    const isFirstCampaignFunding = !user.qualificationMilestones?.firstCampaignFunded;

    const verifiedQuote = quote
      ? await verifySignedQuote(quote, { purpose: 'wallet_funding' })
      : await buildSignedQuote({
          amount: Number(amount),
          fromCurrency: fundingCurrency,
          toCurrency: fundingCurrency,
          purpose: 'wallet_funding',
        });

    const baseCurrency = normalizeCurrencyCode(verifiedQuote.baseCurrency || user.wallets?.marketer?.baseCurrency || 'NGN');
    const nativeAmount = roundCurrencyAmount(verifiedQuote.targetCurrency === fundingCurrency
      ? verifiedQuote.targetAmount
      : Number(amount));
    const baseAmount = roundCurrencyAmount(verifiedQuote.baseAmount);

    ensureWalletCurrencyState(user.wallets.marketer, baseCurrency);
    applyWalletCredit(user.wallets.marketer, {
      bucket: 'balance',
      amount: nativeAmount,
      currency: fundingCurrency,
      baseAmount,
      baseCurrency,
    });

    user.wallets.marketer.transactions.unshift({
      amount: nativeAmount,
      baseAmount,
      currency: fundingCurrency,
      baseCurrency,
      settlementCurrency: fundingCurrency,
      settlementAmount: nativeAmount,
      exchangeRate: Number(verifiedQuote.exchangeRate || 1),
      type: 'credit',
      category: 'deposit',
      description: `Paystack funding`,
      reference,
      status: 'successful',
      gateway: 'paystack',
      meta: {
        paystackReference: reference,
        paystackResponse: {
          id: verificationData.id,
          domain: verificationData.domain,
          channel: verificationData.channel,
          ipAddress: verificationData.ip_address,
          createdAt: verificationData.created_at,
          currency: verificationData.currency,
        },
        quote: verifiedQuote,
      },
      processedAt: new Date(),
      createdAt: new Date(),
    });
    user.wallets.marketer.transactions = user.wallets.marketer.transactions.slice(0, 500);

    if (isFirstCampaignFunding) {
      user.qualificationMilestones.firstCampaignFunded = true;
    }

    const updateResult = await user.save({ session });

    // 9. Commit transaction
    await session.commitTransaction();
    session.endSession();

    // 10. Handle referral (don't await - run in background)
    if (isFirstCampaignFunding && amount >= 2000) {
      referralService.checkMarketerFirstCampaign(userId).catch(err => {
        console.error('Referral processing error:', err);
      });
    }

    // 11. Send email (don't await - run in background)
    sendEmail(
      user.email, 
      'Payment Approved', 
      paymentApprovedEmailTemplate({
      userName: user.displayName,
        amount: nativeAmount,
        transactionReference: reference,
        newBalance: updateResult.wallets.marketer.balance,
      })
    ).catch(err => console.error('Email sending error:', err));

    // 12. Return success
    res.status(200).json({
      success: true,
      message: 'Payment verified and wallet funded successfully.',
      newBalance: updateResult.wallets.marketer.balance,
      transactionId: updateResult.wallets.marketer.transactions[0]?._id,
      isFirstCampaignFunding
    });

  } catch (error) {
    // Rollback on any error
    await session.abortTransaction();
    session.endSession();
    
    console.error('Payment recording error:', error);
    
    // Send declined email
    try {
      const user = await UserModel.findById(userId);
      if (user) {
        await sendEmail(
          user.email,
          'Payment Declined',
          paymentDeclinedEmailTemplate({
            userName: user.displayName,
            amount: amount,
            transactionReference: reference,
            reason: 'System error processing payment. Please contact support.',
          })
        );
      }
    } catch (emailError) {
      console.error('Failed to send declined email:', emailError);
    }

    sendError(res, 'Failed to record payment. Please contact support.', 500);
  }
};

/* export const verifyAndRecordPayment = async (req, res) => {
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
}; */


export const verifyPaymentStatus = async (req, res) => {
  const { reference } = req.params;

  try {
    // Check if transaction exists
    const user = await UserModel.findOne({
      $or: [
        { 'wallets.marketer.transactions.reference': reference },
        { 'wallets.promoter.transactions.reference': reference }
      ]
    });

    if (user) {
      if (req.user.role !== 'admin' && user._id.toString() !== req.userId) {
        return res.status(403).json({
          success: false,
          message: 'You are not allowed to inspect this payment reference'
        });
      }

      return res.status(200).json({
        success: true,
        exists: true,
        recorded: true,
        message: 'Payment found in system'
      });
    }

    // Verify with Paystack
    const response = await axios.get(`${PAYSTACK_VERIFY_URL}${reference}`, {
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    res.status(200).json({
      success: true,
      exists: false,
      recorded: false,
      paystackStatus: response.data.data.status,
      message: 'Payment verified with Paystack but not in system'
    });

  } catch (error) {
    sendError(res, 'Verification failed', 500);
  }
};
