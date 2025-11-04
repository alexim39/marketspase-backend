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
 * --- Helper: Relaxed single-name matching ---
 */
const relaxedSingleNameMatching = (userParts, accountParts) => {
  if (userParts.length === 0 || accountParts.length === 0) return false;
  if (userParts.length === 1 && accountParts.length === 1) {
    return isNameComponentMatch(userParts[0], accountParts[0]);
  }
  const singlePart = userParts.length === 1 ? userParts[0] : accountParts[0];
  const multiParts = userParts.length === 1 ? accountParts : userParts;
  return multiParts.some((part) => isNameComponentMatch(singlePart, part));
};

/**
 * --- Helper: Account ownership verification ---
 */
const validateAccountOwnership = (user, accountNumber, accountName) => {
  const savedAccount = user.savedAccounts.find(
    (account) => account.accountNumber === accountNumber
  );

  if (savedAccount) {
    if (savedAccount.verified) {
      console.log(`Using pre-verified account: ${accountNumber}`);
      return true;
    }

    const isNameMatch = validateNameWithProfile(user, accountName);
    console.log(`Saved account name match result: ${isNameMatch}`);
    return isNameMatch;
  }

  const isNameMatch = validateNameWithProfile(user, accountName);
  console.log(`New account name match result: ${isNameMatch}`);
  return isNameMatch;
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
  const { bank, accountNumber, accountName, amount, userId, saveAccount, bankName } = req.body;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // --- 1. Validate input ---
    if (!userId || !amount || !bank || !accountNumber || !accountName) {
      await session.abortTransaction();
      return res.status(400).json({
        message: "Missing required fields.",
        success: false,
        code: "MISSING_REQUIRED_FIELDS",
      });
    }

    const withdrawalAmount = Number(amount);
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
    const requiresAdditionalVerification =
      withdrawalAmount > 50000 || isNewAccount;

    const promoterWallet = user.wallets.promoter;

    // --- 3. Balance and Fees ---
    const WITHDRAWAL_FEE_RATE = 0.015;
    const WITHDRAWAL_FLAT_FEE = 100;
    const withdrawalFee = Math.max(withdrawalAmount * WITHDRAWAL_FEE_RATE, WITHDRAWAL_FLAT_FEE);
    const totalDeduction = withdrawalAmount + withdrawalFee;

    if (promoterWallet.balance < totalDeduction) {
      await session.abortTransaction();
      return res.status(400).json({
        message: "Insufficient balance.",
        success: false,
      });
    }

    // Deduct balance
    promoterWallet.balance -= totalDeduction;

    // --- 4. Create transaction record ---
    const newTransaction = {
      amount: withdrawalAmount,
      fee: withdrawalFee,
      totalDeduction,
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
    const paymentResponse = await processPayment(bank, accountNumber, accountName, withdrawalAmount);
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
      promoterWallet.balance += totalDeduction;
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
      promoterWallet.balance += totalDeduction;
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
          fee: withdrawalFee,
          newBalance: promoterWallet.balance,
        });
        await sendEmail(user.email, "Withdrawal Successful - MarketSpase", emailContent);
      } else if (transactionToUpdate.status === "failed") {
        const emailContent = withdrawalFailedTemplate({
          userName: user.displayName,
          amount: withdrawalAmount,
          accountNumber: accountNumber.slice(-4),
          bankName,
          reason: transactionToUpdate.failureReason,
          refundedAmount: totalDeduction,
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



/* export const withdrawRequest = async (req, res) => {
  const { bank, accountNumber, accountName, amount, userId, saveAccount, bankName } = req.body;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // --- 1. Validate input ---
    if (!userId || !amount || !bank || !accountNumber || !accountName) {
      await session.abortTransaction();
      return res.status(400).json({
        message: "Missing required fields.",
        success: false,
        code: "MISSING_REQUIRED_FIELDS",
      });
    }

    const withdrawalAmount = Number(amount);
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
    const requiresAdditionalVerification = requireAccountVerification(
      withdrawalAmount,
      isNewAccount
    );

    if (requiresAdditionalVerification) {
      console.log(
        `Additional verification recommended for withdrawal: ${withdrawalAmount} (${isNewAccount ? "new account" : "existing"})`
      );
    }

    const promoterWallet = user.wallets.promoter;

    // --- 3. Balance and Fees ---
    const WITHDRAWAL_FEE_RATE = 0.015;
    const WITHDRAWAL_FLAT_FEE = 100;
    const withdrawalFee = Math.max(withdrawalAmount * WITHDRAWAL_FEE_RATE, WITHDRAWAL_FLAT_FEE);
    const totalDeduction = withdrawalAmount + withdrawalFee;

    if (promoterWallet.balance < totalDeduction) {
      await session.abortTransaction();
      return res.status(400).json({
        message: "Insufficient balance.",
        success: false,
      });
    }

    // Deduct balance
    promoterWallet.balance -= totalDeduction;

    // --- 4. Create transaction record ---
    const newTransaction = {
      amount: withdrawalAmount,
      fee: withdrawalFee,
      totalDeduction,
      type: "debit",
      category: "withdrawal",
      description: `Withdrawal to ${bankName} account ending in ${accountNumber.slice(-4)}`,
      status: "processing",
      createdAt: new Date(),
      bankDetails: { bank: bankName, bankCode: bank, accountNumber, accountName },
      securityFlags: {
        accountVerified: verificationLevel !== "unverified",
        verificationLevel,
        isNewAccount,
        requiresAdditionalVerification,
        nameMatchDetails: {
          userDisplayName: user.displayName,
          providedAccountName: accountName,
        },
      },
    };

    promoterWallet.transactions.push(newTransaction);
    const transactionToUpdate = promoterWallet.transactions[promoterWallet.transactions.length - 1];

    // --- 5. Process payment ---
    const paymentResponse = await processPayment(bank, accountNumber, accountName, withdrawalAmount);
    if (paymentResponse.reference) transactionToUpdate.reference = paymentResponse.reference;

    // --- CASE 1: Requires approval ---
    if (paymentResponse.requiresApproval) {
      transactionToUpdate.status = "pending";
      transactionToUpdate.failureReason = paymentResponse.message;
      cleanInvalidTransactionIds(promoterWallet);
      await user.save({ session });
      await session.commitTransaction();

      return res.status(400).json({
        message: "Withdrawal requires manual approval.",
        success: false,
      });
    }

    // --- CASE 2: Insufficient Paystack balance ---
    if (paymentResponse.insufficientBalance) {
      promoterWallet.balance += totalDeduction;
      transactionToUpdate.status = "failed";
      transactionToUpdate.failureReason = "Service temporarily unavailable";
      cleanInvalidTransactionIds(promoterWallet);
      await user.save({ session });
      await session.commitTransaction();

      return res.status(503).json({
        message: "Withdrawal service temporarily unavailable. Please try again later.",
        success: false,
      });
    }

    // --- CASE 3: Immediate success ---
    if (paymentResponse.success && paymentResponse.status === "success") {
      transactionToUpdate.status = "successful";
      transactionToUpdate.processedAt = new Date();

      // if (saveAccount) {
      //   const existingAccount = user.savedAccounts.find(
      //     (a) => a.accountNumber === accountNumber
      //   );
      //   if (!existingAccount) {
      //     user.savedAccounts.push({
      //       bank: bankName,
      //       bankCode: bank,
      //       accountNumber,
      //       accountName,
      //       verified: true,
      //       verifiedAt: new Date(),
      //       firstUsed: new Date(),
      //       lastUsed: new Date(),
      //     });
      //   } else existingAccount.lastUsed = new Date();
      // }

      console.log('saveAccount ',saveAccount)

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
          });
        }
      }


      cleanInvalidTransactionIds(promoterWallet);
      await user.save({ session });
      await session.commitTransaction();

      try {
        const emailContent = withdrawalSuccessfulTemplate({
          userName: user.displayName,
          amount: withdrawalAmount,
          accountNumber: accountNumber.slice(-4),
          bankName,
          fee: withdrawalFee,
          newBalance: promoterWallet.balance,
        });
        await sendEmail(user.email, "Withdrawal Successful - MarketSpase", emailContent);
      } catch (err) {
        console.error("Failed to send success email:", err);
      }

      return res.status(200).json({
        message: "Withdrawal successful! Payment has been processed.",
        success: true,
        data: {
          balance: promoterWallet.balance,
          transaction: transactionToUpdate,
        },
      });
    }

    // --- CASE 4: Payment in progress (processing) ---
    if (paymentResponse.success) {
      cleanInvalidTransactionIds(promoterWallet);
      await user.save({ session });
      await session.commitTransaction();

      await user.logActivity(
        "withdrawal_complete",
        "Withdrawal request is being processed",
        {}
      );

      return res.status(200).json({
        message: "Withdrawal request received and is being processed.",
        success: true,
      });
    }

    // --- CASE 5: Payment failed ---
    transactionToUpdate.status = "failed";
    transactionToUpdate.failureReason = paymentResponse.message || "Payment failed";
    transactionToUpdate.processedAt = new Date();
    promoterWallet.balance += totalDeduction;

    cleanInvalidTransactionIds(promoterWallet);
    await user.save({ session });
    await session.commitTransaction();

    try {
      const emailContent = withdrawalFailedTemplate({
        userName: user.displayName,
        amount: withdrawalAmount,
        accountNumber: accountNumber.slice(-4),
        bankName,
        reason: transactionToUpdate.failureReason,
        refundedAmount: totalDeduction,
        newBalance: promoterWallet.balance,
      });
      await sendEmail(user.email, "Withdrawal Failed - MarketSpase", emailContent);
    } catch (err) {
      console.error("Failed to send failure email:", err);
    }

    return res.status(500).json({
      message: `Payment failed: ${transactionToUpdate.failureReason}`,
      success: false,
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
 */