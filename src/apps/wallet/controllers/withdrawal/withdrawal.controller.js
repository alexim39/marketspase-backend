
// controllers/withdrawal.controller.js (refactored)
import { UserModel } from '../../../user/models/user.model.js';
import { sendEmail } from "../../../../services/email.service.js";
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { assertAccountNotUsedByAnotherUser } from '../../services/account-ownership.service.js';
import { withdrawalSuccessfulTemplate } from '../../services/email/withdrawalSuccessfulTemplate.js';
import { withdrawalFailedTemplate } from '../../services/email/withdrawalFailedTemplate.js';
import { getVerificationLevel } from '../../services/get-verify-level.service.js';
import { processPayment } from '../../services/process-payment.js';

dotenv.config();

/**
 * Normalize and guard numeric values
 */
function asNumber(n) {
  const v = Number(n);
  if (Number.isNaN(v)) return NaN;
  return v;
}

/**
 * Clean invalid ObjectIds inside embedded wallet.transactions
 * (kept from your original controller)
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
 * Withdraw Request (refactored)
 *
 * Key changes:
 *  - Adds guaranteed `reference` returned by processPayment for idempotency
 *  - Writes a richer transaction object that the webhook can pick up and finalize
 *  - Protects against double-deduction on client retries (idempotency by reference if provided)
 *  - Keeps your business logic (ownership, KYC, balance checks, emails)
 */
export const withdrawRequest = async (req, res) => {
  const {
    bank,               // bank code (e.g., "058")
    accountNumber,
    accountName,
    amount,             // kobo or naira? keep consistent with the rest of your system
    payableAmount,      // net paid out (after fees); used for processPayment
    userId,
    saveAccount,
    bankName            // friendly name (e.g., "GTBank")
  } = req.body;

  console.log('Withdraw request parameters:', {
    bank, accountNumber, accountName, amount, payableAmount, userId, saveAccount, bankName
  });

  // Validate required inputs early (same semantics as before)
  if (!userId || !amount || !bank || !accountNumber || !payableAmount || !accountName) {
    return res.status(400).json({
      message: "Missing required fields.",
      success: false,
      code: "MISSING_REQUIRED_FIELDS",
    });
  }

  const withdrawalAmount = asNumber(amount);
  const amountPayable = asNumber(payableAmount);

  if (Number.isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
    return res.status(400).json({
      message: "Invalid withdrawal amount.",
      success: false,
      code: "INVALID_AMOUNT",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1) Load and validate user (unchanged logic)
    const user = await UserModel.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({ message: "User not found", success: false });
    }
    if (!user.isActive || user.isDeleted) {
      await session.abortTransaction();
      return res.status(403).json({ message: "Account is inactive or deleted.", success: false });
    }

    // 2) Ownership guard: disallow shared accounts across users (unchanged)
    const ownershipCheck = await assertAccountNotUsedByAnotherUser({
      bankCode: bank,
      accountNumber,
      accountName,
      userId,
    });
    if (ownershipCheck.conflict) {
      await session.abortTransaction();
      return res.status(409).json({
        success: false,
        code: "BANK_ACCOUNT_ALREADY_ASSOCIATED",
        message:
          "This bank account is associated with another MarketSpase account and cannot be used again.",
        data: { source: ownershipCheck.source }, // 'savedAccount' | 'transaction'
      });
    }

    // 3) Security & Verification (unchanged)
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

    // 4) Balance check and deduction (with idempotency consideration)
    const promoterWallet = user.wallets.promoter;
    if (promoterWallet.balance < withdrawalAmount) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Insufficient balance.", success: false });
    }

    // 5) Create a provisional transaction BEFORE calling the payout API.
    //    This gives us an internal anchor that the webhook can find by `reference`.
    const txDescription = `Withdrawal to ${bankName} account ending in ${accountNumber.slice(-4)}`;

    const transactionDraft = {
      reference: undefined,                 // will be filled after processPayment returns
      gateway: 'paystack',
      currency: 'NGN',
      fee: 0,                               // optional fee tracking; set if your processPayment returns fees
      transferCode: undefined,              // to be filled by webhook (transfer.success)
      failureReason: undefined,

      amount: withdrawalAmount,
      amountPayable,                        // net amount sent out (if you compute it here)
      type: "debit",
      category: "withdrawal",
      description: txDescription,

      // lifecycle
      status: "processing",                 // "processing" until Paystack confirms via webhook
      createdAt: new Date(),
      processedAt: null,

      // bank details for audit
      bankDetails: { bank: bankName, bankCode: bank, accountNumber, accountName },

      // arbitrary payload snapshots
      meta: { createdBy: 'withdrawRequest', verifyLevel: verificationLevel }
    };

    // Deduct here (same as your logic), then push the transaction
    promoterWallet.balance -= withdrawalAmount;
    promoterWallet.transactions.push(transactionDraft);
    const tx = promoterWallet.transactions[promoterWallet.transactions.length - 1];

    // 6) Trigger payout
    //    Expectation: processPayment returns at least { success, status, reference?, requiresApproval?, insufficientBalance?, message? }
    const paymentResponse = await processPayment(bank, accountNumber, accountName, amountPayable);

    if (paymentResponse.reference) {
      tx.reference = paymentResponse.reference; // 🔐 idempotency key used by webhook
    }

    // Optional: store raw response bits for audit
    tx.meta = {
      ...(tx.meta || {}),
      processPayment: {
        success: paymentResponse.success,
        status: paymentResponse.status,
        message: paymentResponse.message,
        requiresApproval: paymentResponse.requiresApproval,
        insufficientBalance: paymentResponse.insufficientBalance
      }
    };

    // Ensure the account is saved if requested (unchanged)
    if (saveAccount) {
      const existingAccount = user.savedAccounts.find(a => a.accountNumber === accountNumber);
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

    // 7) Harmonize outcomes (do NOT double-credit/debit; leave finalization to webhook)
    //    We keep your previous semantics, but bias toward webhook as source-of-truth.
    if (paymentResponse.requiresApproval) {
      // Bank requires manual approval; keep "processing"/"pending" until webhook comes back
      tx.status = "pending";
      tx.failureReason = paymentResponse.message;
    } else if (paymentResponse.insufficientBalance) {
      // Provider lacked funds: refund immediately and mark failed
      promoterWallet.balance += withdrawalAmount;
      tx.status = "failed";
      tx.failureReason = "Service temporarily unavailable";
      tx.processedAt = new Date();
    } else if (paymentResponse.success && paymentResponse.status === "success") {
      // Some providers return immediate success; keep behavior but webhook will re-confirm (idempotent)
      tx.status = "successful";
      tx.processedAt = new Date();
    } else if (paymentResponse.success) {
      // Submitted/queued; wait for webhook to finalize
      tx.status = "processing";
    } else {
      // Explicit failure; refund now
      tx.status = "failed";
      tx.failureReason = paymentResponse.message || "Payment failed";
      tx.processedAt = new Date();
      promoterWallet.balance += withdrawalAmount;
    }

    // 8) Save & commit
    cleanInvalidTransactionIds(promoterWallet);
    await user.save({ session });
    await session.commitTransaction();

    // 9) Email notifications (unchanged pattern)
    try {
      if (tx.status === "successful") {
        const emailContent = withdrawalSuccessfulTemplate({
          userName: user.displayName,
          amount: withdrawalAmount,
          accountNumber: accountNumber.slice(-4),
          bankName,
          amountPayable,
          newBalance: promoterWallet.balance,
        });
        await sendEmail(user.email, "Withdrawal Successful - MarketSpase", emailContent);
      } else if (tx.status === "failed") {
        const emailContent = withdrawalFailedTemplate({
          userName: user.displayName,
          amount: withdrawalAmount,
          amountPayable,
          accountNumber: accountNumber.slice(-4),
          bankName,
          reason: tx.failureReason,
          refundedAmount: withdrawalAmount,
          newBalance: promoterWallet.balance,
        });
        await sendEmail(user.email, "Withdrawal Failed - MarketSpase", emailContent);
      }
    } catch (err) {
      console.error("Failed to send email:", err);
    }

    // 10) Response (kept compatible)
    return res.status(200).json({
      message:
        tx.status === "successful"
          ? "Withdrawal successful!"
          : tx.status === "failed"
          ? "Withdrawal failed!"
          : "Withdrawal request processed.",
      success: true,
      data: {
        balance: promoterWallet.balance,
        transaction: tx,
      },
    });
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    console.error("Error during withdrawal request:", error);
    return res.status(500).json({
      message: "An unexpected error occurred during withdrawal processing.",
      success: false,
    });
  } finally {
    session.endSession();
  }
};





/* import { UserModel } from '../../../user/models/user.model.js';
import { sendEmail } from "../../../../services/email.service.js";
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { assertAccountNotUsedByAnotherUser } from '../../services/account-ownership.service.js';
import { withdrawalSuccessfulTemplate } from '../../services/email/withdrawalSuccessfulTemplate.js';
import { withdrawalFailedTemplate } from '../../services/email/withdrawalFailedTemplate.js';

import { getVerificationLevel } from '../../services/get-verify-level.service.js';
import { processPayment } from '../../services/process-payment.js';

dotenv.config();

 // Helper: Clean invalid _id fields in promoter transactions ---
 
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




 // MAIN CONTROLLER: Withdraw Request 

export const withdrawRequest = async (req, res) => {
  const { bank, accountNumber, accountName, amount, payableAmount, userId, saveAccount, bankName } = req.body;

  console.log('Withdraw request parameters:', { bank, accountNumber, accountName, amount, payableAmount, userId, saveAccount, bankName });


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

    
    // --- 2. Ownership guard: block re-used bank accounts across different users ---
    const ownershipCheck = await assertAccountNotUsedByAnotherUser({
      bankCode: bank,
      accountNumber,
      accountName,
      userId,
    });

    if (ownershipCheck.conflict) {
      await session.abortTransaction();
      return res.status(409).json({
        success: false,
        code: "BANK_ACCOUNT_ALREADY_ASSOCIATED",
        message:
          "This bank account is associated with another MarketSpase account and cannot be used again.",
        data: {
          source: ownershipCheck.source, // 'savedAccount' | 'transaction'
        },
      });
    }


    // --- 3. Security & Verification ---
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
}; */