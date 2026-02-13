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

function asNumber(n) { const v = Number(n); return Number.isNaN(v) ? NaN : v; }

const cleanInvalidTransactionIds = (wallet) => {
  if (!wallet || !Array.isArray(wallet.transactions)) return;
  wallet.transactions = wallet.transactions.map((tx) => {
    try { if (tx._id && !mongoose.isValidObjectId(tx._id)) tx._id = new mongoose.Types.ObjectId(); }
    catch { tx._id = new mongoose.Types.ObjectId(); }
    return tx;
  });
};

export const withdrawRequest = async (req, res) => {
  const { bank, accountNumber, accountName, amount, userId, saveAccount, bankName } = req.body;

  if (!userId || !amount || !bank || !accountNumber || !accountName) {
    return res.status(400).json({ message: "Missing required fields.", success: false, code: "MISSING_REQUIRED_FIELDS" });
  }

  const withdrawalAmount = asNumber(amount);
  if (Number.isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
    return res.status(400).json({ message: "Invalid withdrawal amount.", success: false, code: "INVALID_AMOUNT" });
  }

  // Compute but DO NOT deduct the fee here (fee on success)
  const serviceFee = Math.round(withdrawalAmount * 0.18);
  const amountPayable = withdrawalAmount - serviceFee;

  try {
    const user = await UserModel.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found", success: false });
    if (!user.isActive || user.isDeleted) return res.status(403).json({ message: "Account inactive or deleted.", success: false });

    const ownershipCheck = await assertAccountNotUsedByAnotherUser({ bankCode: bank, accountNumber, accountName, userId });
    if (ownershipCheck.conflict) {
      return res.status(409).json({
        success: false,
        code: "BANK_ACCOUNT_ALREADY_ASSOCIATED",
        message: "This bank account belongs to another user.",
        data: { source: ownershipCheck.source },
      });
    }

    const verificationLevel = getVerificationLevel(user, accountNumber, accountName);
    if (verificationLevel === "unverified") {
      return res.status(403).json({ message: "Account ownership verification failed.", success: false, code: "ACCOUNT_OWNERSHIP_VERIFICATION_FAILED" });
    }

    const promoterWallet = user.wallets.promoter;
    if (promoterWallet.balance < withdrawalAmount) {
      return res.status(400).json({ message: "Insufficient balance.", success: false });
    }

    // Deduct ONLY the gross amount upfront
    promoterWallet.balance -= withdrawalAmount;

    // Draft transaction (fee=0 for now — will be set on success)
    const tx = {
      reference: undefined,
      gateway: "paystack",
      currency: "NGN",
      fee: 0, // set at finalizeTransfer success
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
      bankDetails: { bank: bankName, bankCode: bank, accountNumber, accountName },
      meta: { createdBy: "withdrawRequest", verifyLevel: verificationLevel },
    };

    promoterWallet.transactions.push(tx);
    const txRef = promoterWallet.transactions[promoterWallet.transactions.length - 1];

    // Provider call for NET amount
    const paymentResponse = await processPayment(bank, accountNumber, accountName, amountPayable);

    if (paymentResponse.reference) txRef.reference = paymentResponse.reference;

    txRef.meta.processPayment = {
      success: paymentResponse.success,
      status: paymentResponse.status,
      message: paymentResponse.message,
      requiresApproval: paymentResponse.requiresApproval,
      insufficientBalance: paymentResponse.insufficientBalance,
    };

    // Handle immediate provider outcomes
    if (paymentResponse.status === "blocked") {
      promoterWallet.balance += withdrawalAmount; // refund gross only
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

    if (paymentResponse.insufficientBalance) {
      promoterWallet.balance += withdrawalAmount; // refund gross only
      txRef.status = "failed";
      txRef.failureReason = "Provider insufficient balance";
      txRef.processedAt = new Date();
      cleanInvalidTransactionIds(promoterWallet);
      await user.save();
      return res.status(200).json({
        success: false,
        message: "Withdrawal failed!",
        data: { balance: promoterWallet.balance, transaction: txRef },
      });
    }

    // Keep non-terminal; webhook/recon will finalize success/failure
    txRef.status = "processing";

    cleanInvalidTransactionIds(promoterWallet);
    await user.save();

    return res.status(200).json({
      message: "Withdrawal request processed.",
      success: true,
      data: { balance: promoterWallet.balance, transaction: txRef },
    });

  } catch (error) {
    console.error("Withdrawal error:", error);
    return res.status(500).json({ message: "Unexpected error occurred.", success: false });
  }
};