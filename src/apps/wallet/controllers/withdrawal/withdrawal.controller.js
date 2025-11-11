import { UserModel } from '../../../user/models/user.model.js';
import { sendEmail } from "../../../../services/email.service.js";
import mongoose from 'mongoose';
import dotenv from 'dotenv';

import { withdrawalSuccessfulTemplate } from '../../services/email/withdrawalSuccessfulTemplate.js';
import { withdrawalFailedTemplate } from '../../services/email/withdrawalFailedTemplate.js';
import { accountVerifiedTemplate } from '../../services/email/accountVerifiedTemplate.js';

import { getVerificationLevel } from '../../services/get-verify-level.service.js';
import { validateNameWithProfile } from '../../services/validate-name-with-profile.service.js';
import { isNameComponentMatch } from '../../services/name-matching.service.js';
import { processPayment } from '../../services/process-payment.js';

dotenv.config();

/**
 * --- Helper: Clean invalid _id fields in promoter transactions ---
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
 * --- Helper: Additional verification requirement ---
 */
const requireAccountVerification = (amount, isNewAccount) => {
  const HIGH_AMOUNT_THRESHOLD = 50000;
  return amount > HIGH_AMOUNT_THRESHOLD || isNewAccount;
};

/**
 * --- MAIN CONTROLLER: Withdraw Request ---
 */

export const withdrawRequest = async (req, res) => {
  const { bank, accountNumber, accountName, amount, payableAmount, userId, saveAccount, bankName } = req.body;

  console.log('Withdraw request received:', req.body);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // --- 1. Validate input ---
    if (!userId || !amount || !bank || !accountNumber || !payableAmount || !accountName) {
      await session.abortTransaction();
      return res.status(400).json({
        message: "Missing required fields.",
        success: false,
        code: "MISSING_REQUIRED_FIELDS",
      });
    }

    const withdrawalAmount = Number(amount);
    const amountPayable = Number(payableAmount);
    if (isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
      await session.abortTransaction();
      return res.status(400).json({
        message: "Invalid withdrawal amount.",
        success: false,
        code: "INVALID_AMOUNT",
      });
    }

    const user = await UserModel.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({
        message: "User not found",
        success: false,
      });
    }

    if (!user.isActive || user.isDeleted) {
      await session.abortTransaction();
      return res.status(403).json({
        message: "Account is inactive or deleted.",
        success: false,
      });
    }

    // --- 2. Security & Verification ---
    const verificationLevel = getVerificationLevel(user, accountNumber, accountName);
    if (verificationLevel === "unverified") {
      await session.abortTransaction();
      return res.status(403).json({
        message:
          "Account ownership verification failed. Please ensure you're using your own bank account.",
        success: false,
        code: "ACCOUNT_OWNERSHIP_VERIFICATION_FAILED",
      });
    }

    const isNewAccount = !user.savedAccounts.some(
      (account) => account.accountNumber === accountNumber
    );
    const requiresAdditionalVerification =  withdrawalAmount > 50000 || isNewAccount;

    const promoterWallet = user.wallets.promoter;


    if (promoterWallet.balance < withdrawalAmount) {
      await session.abortTransaction();
      return res.status(400).json({
        message: "Insufficient balance.",
        success: false,
      });
    }

    // Deduct balance
    promoterWallet.balance -= withdrawalAmount;

    // --- 4. Create transaction record ---
    const newTransaction = {
      amount: withdrawalAmount,
      //fee: withdrawalFee,
      withdrawalAmount,
      amountPayable,
      type: "debit",
      category: "withdrawal",
      description: `Withdrawal to ${bankName} account ending in ${accountNumber.slice(-4)}`,
      status: "processing",
      createdAt: new Date(),
      bankDetails: { bank: bankName, bankCode: bank, accountNumber, accountName },
    };

    promoterWallet.transactions.push(newTransaction);
    const transactionToUpdate = promoterWallet.transactions[promoterWallet.transactions.length - 1];

    // --- 5. Process payment ---
    const paymentResponse = await processPayment(bank, accountNumber, accountName, amountPayable);
    if (paymentResponse.reference)
      transactionToUpdate.reference = paymentResponse.reference;

    // --- 🔹 Always save the account if requested ---
    if (saveAccount) {
      const existingAccount = user.savedAccounts.find(
        (a) => a.accountNumber === accountNumber
      );

      if (!existingAccount) {
        user.savedAccounts.push({
          bank: bankName,
          bankCode: bank,
          accountNumber,
          accountName,
          verified: true,
          verifiedAt: new Date(),
          firstUsed: new Date(),
          lastUsed: new Date(),
        });
      } else {
        existingAccount.lastUsed = new Date();
      }
    }

    // --- Handle different payment outcomes ---
    if (paymentResponse.requiresApproval) {
      transactionToUpdate.status = "pending";
      transactionToUpdate.failureReason = paymentResponse.message;
    } else if (paymentResponse.insufficientBalance) {
      promoterWallet.balance += withdrawalAmount;
      transactionToUpdate.status = "failed";
      transactionToUpdate.failureReason = "Service temporarily unavailable";
    } else if (paymentResponse.success && paymentResponse.status === "success") {
      transactionToUpdate.status = "successful";
      transactionToUpdate.processedAt = new Date();
    } else if (paymentResponse.success) {
      transactionToUpdate.status = "processing";
    } else {
      transactionToUpdate.status = "failed";
      transactionToUpdate.failureReason = paymentResponse.message || "Payment failed";
      transactionToUpdate.processedAt = new Date();
      promoterWallet.balance += withdrawalAmount;
    }

    // --- Save updates and commit ---
    cleanInvalidTransactionIds(promoterWallet);
    await user.save({ session });
    await session.commitTransaction();

    // --- Email handling ---
    try {
      if (transactionToUpdate.status === "successful") {
        const emailContent = withdrawalSuccessfulTemplate({
          userName: user.displayName,
          amount: withdrawalAmount,
          accountNumber: accountNumber.slice(-4),
          bankName,
          //fee: withdrawalFee,
          amountPayable,
          newBalance: promoterWallet.balance,
        });
        await sendEmail(user.email, "Withdrawal Successful - MarketSpase", emailContent);
      } else if (transactionToUpdate.status === "failed") {
        const emailContent = withdrawalFailedTemplate({
          userName: user.displayName,
          amount: withdrawalAmount,
          amountPayable,
          accountNumber: accountNumber.slice(-4),
          bankName,
          reason: transactionToUpdate.failureReason,
          refundedAmount: withdrawalAmount,
          newBalance: promoterWallet.balance,
        });
        await sendEmail(user.email, "Withdrawal Failed - MarketSpase", emailContent);
      }
    } catch (err) {
      console.error("Failed to send email:", err);
    }

    // --- Response ---
    return res.status(200).json({
      message:
        transactionToUpdate.status === "successful"
          ? "Withdrawal successful!"
          : transactionToUpdate.status === "failed"
          ? "Withdrawal failed!"
          : "Withdrawal request processed.",
      success: true,
      data: {
        balance: promoterWallet.balance,
        transaction: transactionToUpdate,
      },
    });
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    console.error("Error during withdrawal request:", error);
    res.status(500).json({
      message: "An unexpected error occurred during withdrawal processing.",
      success: false,
    });
  } finally {
    session.endSession();
  }
};