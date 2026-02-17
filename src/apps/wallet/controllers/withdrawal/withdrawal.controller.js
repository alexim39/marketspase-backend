// controllers/withdrawal.controller.js
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
    bank,               // bank code (e.g., "058")
    accountNumber,
    accountName,
    amount,             // KOBO
    userId,
    saveAccount,
    bankName
  } = req.body;

  console.log('sent body ',req.body)

  if (!userId || !amount || !bank || !accountNumber || !accountName) {
    return res.status(400).json({
      message: "Missing required fields.",
      success: false,
      code: "MISSING_REQUIRED_FIELDS",
    });
  }

  // 🔥 Convert UI NAIRA → KOBO
  const withdrawalAmount = Math.round(asNumber(amount) * 100);
  if (Number.isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
    return res.status(400).json({
      message: "Invalid withdrawal amount.",
      success: false,
      code: "INVALID_AMOUNT",
    });
  }
    
  // Fee is computed now BUT NOT deducted until success
  const serviceFee = Math.round(withdrawalAmount * 0.18);
  const amountPayable = withdrawalAmount - serviceFee; // net sent to bank

  try {
    // 1) Load user & basic checks
    const user = await UserModel.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found", success: false });
    if (!user.isActive || user.isDeleted) {
      return res.status(403).json({ message: "Account inactive or deleted.", success: false });
    }

    // 2) Bank ownership guard
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

    // 3) Verification
    const verificationLevel = getVerificationLevel(user, accountNumber, accountName);
    if (verificationLevel === "unverified") {
      return res.status(403).json({
        message: "Account ownership verification failed.",
        success: false,
        code: "ACCOUNT_OWNERSHIP_VERIFICATION_FAILED",
      });
    }

    // 4) Balance check & initial deduction (GROSS only)
    const promoterWallet = user.wallets.promoter;
    if (promoterWallet.balance < amount) {
      return res.status(400).json({ message: "Insufficient balance.", success: false });
    }
    promoterWallet.balance -= amount;

    // 5) Create draft transaction
    const tx = {
      reference: undefined,          // will be set before provider call
      gateway: "paystack",
      currency: "NGN",
      fee: 0,                        // will be set on success only
      transferCode: undefined,
      failureReason: undefined,

      amount,      // GROSS requested
      amountPayable,                 // NET sent to Paystack
      type: "debit",
      category: "withdrawal",
      description: `Withdrawal to ${bankName} ending in ${accountNumber.slice(-4)}`,
      status: "processing",
      createdAt: new Date(),
      processedAt: null,

      providerReference: undefined, // Paystack's reference (not always same as ours)

      bankDetails: { bank: bankName, bankCode: bank, accountNumber, accountName },
      meta: { createdBy: "withdrawRequest", verifyLevel: verificationLevel },
    };

    promoterWallet.transactions.push(tx);
    const txRef = promoterWallet.transactions[promoterWallet.transactions.length - 1];

    // 6) Build/stash a stable reference and call provider (two-step under the hood)
    const safeRef = txRef.reference || `WD_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    if (!txRef.reference) txRef.reference = safeRef;

    const paymentResponse = await processPayment(
      bank,
      accountNumber,
      accountName,
      amountPayable,                          // KOBO
      { userId, reason: "Withdrawal Payment - MarketSpase", reference: safeRef }
    );

    
 // 🔴 CRITICAL: persist provider identifiers for recon
    if (paymentResponse.reference) {
      txRef.providerReference = paymentResponse.reference; // Paystack's reference
    }
    if (paymentResponse.transferCode) {
      txRef.transferCode = paymentResponse.transferCode;   // Paystack's transfer_code (if you pipe it up)
    }


    txRef.meta.processPayment = {
      success: paymentResponse.success,
      status: paymentResponse.status,
      message: paymentResponse.message,
      requiresApproval: paymentResponse.requiresApproval,
      insufficientBalance: paymentResponse.insufficientBalance,
    };

    // Immediate provider outcomes
    if (paymentResponse.status === "blocked") {
      // Refund gross (fee was never deducted)
      promoterWallet.balance += withdrawalAmount;
      txRef.status = "failed";
      txRef.failureReason = "Transfer blocked by provider";
      txRef.processedAt = new Date();
      cleanInvalidTransactionIds(promoterWallet);
      await user.save();
      return res.status(200).json({
        success: false,
        message: "Withdrawal failed (blocked).",
        data: { balance: promoterWallet.balance, transaction: txRef },
      });
    }

    if (paymentResponse.insufficientBalance || paymentResponse.status === "failed") {
      // Refund gross only
      promoterWallet.balance += withdrawalAmount;
      txRef.status = "failed";
      txRef.failureReason = paymentResponse.message || "Provider insufficient balance";
      txRef.processedAt = new Date();
      cleanInvalidTransactionIds(promoterWallet);
      await user.save();
      return res.status(200).json({
        success: false,
        message: "Withdrawal failed!",
        data: { balance: promoterWallet.balance, transaction: txRef },
      });
    }

    // Otherwise keep non-terminal; webhook/recon will finalize success/failure
    txRef.status = "processing";

    // Optionally store/refresh saved account info
    if (saveAccount) {
      const saved = user.savedAccounts.find(a => a.accountNumber === accountNumber && a.bankCode === bank);
      if (!saved) {
        user.savedAccounts.push({
          bank: bankName, bankCode: bank, accountNumber, accountName,
          verified: true, verifiedAt: new Date(), firstUsed: new Date(), lastUsed: new Date()
        });
      } else {
        saved.lastUsed = new Date();
      }
    }

    cleanInvalidTransactionIds(promoterWallet);
    await user.save();

    return res.status(200).json({
      message: "Withdrawal request processed.",
      success: true,
      data: { balance: promoterWallet.balance, transaction: txRef },
    });

  } catch (error) {
    console.error("Withdrawal error:", error);
    return res.status(500).json({
      message: "Unexpected error occurred.",
      success: false,
    });
  }
};