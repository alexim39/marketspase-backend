// controllers/withdrawal.controller.js (cleaned + 18% fee + no Mongo sessions)
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

/** Normalize */
function asNumber(n) {
  const v = Number(n);
  return Number.isNaN(v) ? NaN : v;
}

/** Clean invalid ObjectIds in embedded transactions */
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

export const withdrawRequest = async (req, res) => {
  const {
    bank,
    accountNumber,
    accountName,
    amount,            // promoter withdrawal amount (in KOBO)
    userId,
    saveAccount,
    bankName,
  } = req.body;

  console.log("Withdraw request params:", { bank, accountNumber, accountName, amount, userId, saveAccount, bankName });

  if (!userId || !amount || !bank || !accountNumber || !accountName) {
    return res.status(400).json({
      message: "Missing required fields.",
      success: false,
      code: "MISSING_REQUIRED_FIELDS",
    });
  }

  const withdrawalAmount = asNumber(amount);
  if (Number.isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
    return res.status(400).json({
      message: "Invalid withdrawal amount.",
      success: false,
      code: "INVALID_AMOUNT",
    });
  }

  // 🔥 18% service fee
  const serviceFee = Math.round(withdrawalAmount * 0.18);
  const amountPayable = withdrawalAmount - serviceFee; // net to bank

  try {
    // 1) Load user
    const user = await UserModel.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found", success: false });
    if (!user.isActive || user.isDeleted) {
      return res.status(403).json({ message: "Account inactive or deleted.", success: false });
    }

    // 2) Ensure not using another user’s bank account
    const ownershipCheck = await assertAccountNotUsedByAnotherUser({
      bankCode: bank,
      accountNumber,
      accountName,
      userId,
    });
    if (ownershipCheck.conflict) {
      return res.status(409).json({
        success: false,
        code: "BANK_ACCOUNT_ALREADY_ASSOCIATED",
        message: "This bank account belongs to another user.",
        data: { source: ownershipCheck.source },
      });
    }

    // 3) Verify KYC match
    const verificationLevel = getVerificationLevel(user, accountNumber, accountName);
    if (verificationLevel === "unverified") {
      return res.status(403).json({
        message: "Account verification failed.",
        success: false,
        code: "ACCOUNT_OWNERSHIP_VERIFICATION_FAILED",
      });
    }

    // 4) Check promoter balance
    const promoterWallet = user.wallets.promoter;
    if (promoterWallet.balance < withdrawalAmount) {
      return res.status(400).json({ message: "Insufficient balance.", success: false });
    }

    // Deduct immediately (gross amount)
    promoterWallet.balance -= withdrawalAmount;

    // Create transaction draft
    const txDescription = `Withdrawal to ${bankName} ending in ${accountNumber.slice(-4)}`;

    const transactionDraft = {
      reference: undefined,
      gateway: "paystack",
      currency: "NGN",
      fee: serviceFee,                 // store 18% fee
      transferCode: undefined,
      failureReason: undefined,

      amount: withdrawalAmount,        // gross
      amountPayable,                   // net sent to bank
      type: "debit",
      category: "withdrawal",
      description: txDescription,

      status: "processing",
      createdAt: new Date(),
      processedAt: null,

      bankDetails: { bank: bankName, bankCode: bank, accountNumber, accountName },

      meta: { createdBy: "withdrawRequest", verifyLevel: verificationLevel },
    };

    promoterWallet.transactions.push(transactionDraft);
    const tx = promoterWallet.transactions[promoterWallet.transactions.length - 1];

    // 5) Trigger Paystack payout for NET amount
    const paymentResponse = await processPayment(bank, accountNumber, accountName, amountPayable);

    if (paymentResponse.reference) {
      tx.reference = paymentResponse.reference;
    }

    tx.meta = {
      ...(tx.meta || {}),
      processPayment: {
        success: paymentResponse.success,
        status: paymentResponse.status,
        message: paymentResponse.message,
        requiresApproval: paymentResponse.requiresApproval,
        insufficientBalance: paymentResponse.insufficientBalance,
      },
    };

    // Save account if requested
    if (saveAccount) {
      const exists = user.savedAccounts.find(a => a.accountNumber === accountNumber);
      if (!exists) {
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
        exists.lastUsed = new Date();
      }
    }

    // 6) Handle initial provider outcome
    if (paymentResponse.requiresApproval) {
      tx.status = "pending";
      tx.failureReason = paymentResponse.message;
    } else if (paymentResponse.insufficientBalance) {
      // Refund both amount + fee (OPTION B)
      promoterWallet.balance += (withdrawalAmount + serviceFee);
      tx.status = "failed";
      tx.failureReason = "Provider insufficient balance";
      tx.processedAt = new Date();
    } else if (paymentResponse.success && paymentResponse.status === "success") {
      // Leave final status to webhook
      tx.status = "processing";
    } else if (paymentResponse.success) {
      tx.status = "processing";
    } else {
      // Immediate failure – refund amount + fee (OPTION B)
      promoterWallet.balance += (withdrawalAmount + serviceFee);
      tx.status = "failed";
      tx.failureReason = paymentResponse.message || "Payment failed";
      tx.processedAt = new Date();
    }

    cleanInvalidTransactionIds(promoterWallet);
    await user.save();

    return res.status(200).json({
      message:
        tx.status === "successful"
          ? "Withdrawal successful!"
          : tx.status === "failed"
          ? "Withdrawal failed!"
          : "Withdrawal request processed.",
      success: true,
      data: { balance: promoterWallet.balance, transaction: tx },
    });
  } catch (error) {
    console.error("Error during withdrawal request:", error);
    return res.status(500).json({
      message: "Unexpected error occurred during withdrawal.",
      success: false,
    });
  }
};
