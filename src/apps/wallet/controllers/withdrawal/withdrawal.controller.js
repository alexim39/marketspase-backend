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
    bank,
    accountNumber,
    accountName,
    amount, // UI sends NAIRA
    userId,
    saveAccount,
    bankName
  } = req.body;

  if (!userId || !amount || !bank || !accountNumber || !accountName) {
    return res.status(400).json({
      message: "Missing required fields.",
      success: false,
      code: "MISSING_REQUIRED_FIELDS",
    });
  }

  /**
   * 🔥 FIX 1 — Convert UI NAIRA → KOBO
   */
  const withdrawalAmountNaira = asNumber(amount);

  if (Number.isNaN(withdrawalAmountNaira) || withdrawalAmountNaira <= 0) {
    return res.status(400).json({
      message: "Invalid withdrawal amount.",
      success: false,
      code: "INVALID_AMOUNT",
    });
  }

  const withdrawalAmount = Math.round(withdrawalAmountNaira * 100); // Kobo

  /**
   * 🔥 FIX 2 — Prevent micro transfers (Paystack risk trigger)
   */
  if (withdrawalAmount < 1000) {
    return res.status(400).json({
      success: false,
      message: "Minimum withdrawal is ₦10",
    });
  }

  /**
   * 🔥 FIX 3 — Fee computed in KOBO
   */
  const serviceFee = Math.round(withdrawalAmount * 0.18);
  const amountPayable = withdrawalAmount - serviceFee;

  if (amountPayable < 1000) {
    return res.status(400).json({
      success: false,
      message: "Withdrawal too small after fees.",
    });
  }

  try {

    const user = await UserModel.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found", success: false });
    if (!user.isActive || user.isDeleted) {
      return res.status(403).json({ message: "Account inactive or deleted.", success: false });
    }

    /**
     * Ownership check
     */
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

    /**
     * Verification check
     */
    const verificationLevel = getVerificationLevel(user, accountNumber, accountName);

    if (verificationLevel === "unverified") {
      return res.status(403).json({
        message: "Account ownership verification failed.",
        success: false,
        code: "ACCOUNT_OWNERSHIP_VERIFICATION_FAILED",
      });
    }

    /**
     * Wallet check (wallet already in KOBO)
     */
    const promoterWallet = user.wallets.promoter;

    if (promoterWallet.balance < withdrawalAmount) {
      return res.status(400).json({ message: "Insufficient balance.", success: false });
    }

    /**
     * Deduct GROSS (KOBO)
     */
    promoterWallet.balance -= withdrawalAmount;

    /**
     * Create TX
     */
    const tx = {
      reference: undefined,
      gateway: "paystack",
      currency: "NGN",
      fee: 0,
      transferCode: undefined,
      failureReason: undefined,
      amount: withdrawalAmount,
      amountPayable,
      type: "debit",
      category: "withdrawal",
      description: `Withdrawal to ${bankName} ending in ${accountNumber.slice(-4)}`,
      status: "processing",
      createdAt: new Date(),
      processedAt: null,
      providerReference: undefined,
      bankDetails: { bank: bankName, bankCode: bank, accountNumber, accountName },
      meta: { createdBy: "withdrawRequest", verifyLevel: verificationLevel },
    };

    promoterWallet.transactions.push(tx);
    const txRef = promoterWallet.transactions[promoterWallet.transactions.length - 1];

    const safeRef = txRef.reference || `WD_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    if (!txRef.reference) txRef.reference = safeRef;

    /**
     * 🔥 CALL PAYMENT ENGINE (KOBO)
     */
    const paymentResponse = await processPayment(
      bank,
      accountNumber,
      accountName,
      amountPayable,
      { userId, reason: "Withdrawal Payment - MarketSpase", reference: safeRef }
    );

    /**
     * Store provider identifiers
     */
    if (paymentResponse.reference) {
      txRef.providerReference = paymentResponse.reference;
    }
    if (paymentResponse.transferCode) {
      txRef.transferCode = paymentResponse.transferCode;
    }

    txRef.meta.processPayment = paymentResponse;

    /**
     * Handle immediate failure
     */
    if (paymentResponse.status === "blocked" || paymentResponse.success === false) {

      promoterWallet.balance += withdrawalAmount;

      txRef.status = "failed";
      txRef.failureReason = paymentResponse.message || "Transfer blocked";
      txRef.processedAt = new Date();

      cleanInvalidTransactionIds(promoterWallet);
      await user.save();

      return res.status(200).json({
        success: false,
        message: "Withdrawal failed.",
        data: { balance: promoterWallet.balance, transaction: txRef },
      });
    }

    txRef.status = "processing";

    if (saveAccount) {
      const saved = user.savedAccounts.find(a => a.accountNumber === accountNumber && a.bankCode === bank);
      if (!saved) {
        user.savedAccounts.push({
          bank: bankName,
          bankCode: bank,
          accountNumber,
          accountName,
          verified: true,
          verifiedAt: new Date(),
          firstUsed: new Date(),
          lastUsed: new Date()
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