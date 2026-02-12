// controllers/withdrawal.controller.js (final with 18% fee, OPTION B)
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
  const {
    bank, accountNumber, accountName,
    amount,               // assume KOBO for consistency with Paystack
    userId, saveAccount,
    bankName
  } = req.body;

  console.log('Withdraw request parameters:', { bank, accountNumber, accountName, amount, userId, saveAccount, bankName });

  if (!userId || !amount || !bank || !accountNumber || !accountName) {
    return res.status(400).json({ message: "Missing required fields.", success: false, code: "MISSING_REQUIRED_FIELDS" });
  }

  const withdrawalAmount = asNumber(amount);
  if (Number.isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
    return res.status(400).json({ message: "Invalid withdrawal amount.", success: false, code: "INVALID_AMOUNT" });
  }

  // ✅ 18% fee (OPTION B: fee is refunded on failure/reversal)
  const serviceFee = Math.round(withdrawalAmount * 0.18);
  const amountPayable = withdrawalAmount - serviceFee;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await UserModel.findById(userId).session(session);
    if (!user) { await session.abortTransaction(); return res.status(404).json({ message: "User not found", success: false }); }
    if (!user.isActive || user.isDeleted) { await session.abortTransaction(); return res.status(403).json({ message: "Account is inactive or deleted.", success: false }); }

    // Optional: background freshness marker
    await UserModel.updateOne({ _id: user._id }, { $set: { lastSeenAt: new Date() } });

    const ownershipCheck = await assertAccountNotUsedByAnotherUser({ bankCode: bank, accountNumber, accountName, userId });
    if (ownershipCheck.conflict) {
      await session.abortTransaction();
      return res.status(409).json({
        success: false,
        code: "BANK_ACCOUNT_ALREADY_ASSOCIATED",
        message: "This bank account is associated with another MarketSpase account and cannot be used again.",
        data: { source: ownershipCheck.source },
      });
    }

    const verificationLevel = getVerificationLevel(user, accountNumber, accountName);
    if (verificationLevel === "unverified") {
      await session.abortTransaction();
      return res.status(403).json({
        message: "Account ownership verification failed. Please ensure you're using your own bank account.",
        success: false,
        code: "ACCOUNT_OWNERSHIP_VERIFICATION_FAILED",
      });
    }

    const promoterWallet = user.wallets.promoter;
    if (promoterWallet.balance < withdrawalAmount) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Insufficient balance.", success: false });
    }

    // Create draft tx + deduct up-front (net is sent to bank)
    const txDescription = `Withdrawal to ${bankName} account ending in ${accountNumber.slice(-4)}`;
    const transactionDraft = {
      reference: undefined,
      gateway: 'paystack',
      currency: 'NGN',
      fee: serviceFee,                   // ✅ capture fee on request
      transferCode: undefined,
      failureReason: undefined,

      amount: withdrawalAmount,          // gross requested by promoter
      amountPayable,                     // net paid to bank
      type: "debit",
      category: "withdrawal",
      description: txDescription,

      status: "processing",              // stay non-terminal; webhook/recon will finalize
      createdAt: new Date(),
      processedAt: null,

      bankDetails: { bank: bankName, bankCode: bank, accountNumber, accountName },
      meta: { createdBy: 'withdrawRequest', verifyLevel: verificationLevel }
    };

    promoterWallet.balance -= withdrawalAmount;
    promoterWallet.transactions.push(transactionDraft);
    const tx = promoterWallet.transactions[promoterWallet.transactions.length - 1];

    // Call your payout provider with NET amount
    const paymentResponse = await processPayment(bank, accountNumber, accountName, amountPayable);

    if (paymentResponse.reference) tx.reference = paymentResponse.reference;

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

    if (saveAccount) {
      const existingAccount = user.savedAccounts.find(a => a.accountNumber === accountNumber);
      if (!existingAccount) {
        user.savedAccounts.push({
          bank: bankName, bankCode: bank, accountNumber, accountName,
          verified: true, verifiedAt: new Date(), firstUsed: new Date(), lastUsed: new Date()
        });
      } else {
        existingAccount.lastUsed = new Date();
      }
    }

    // Safer: keep non-terminal status until webhook confirms (recommended)
    if (paymentResponse.requiresApproval) {
      tx.status = "pending";
      tx.failureReason = paymentResponse.message;
    } else if (paymentResponse.insufficientBalance) {
      // Provider issue: rollback immediately (refund amount+fee per OPTION B)
      promoterWallet.balance += (withdrawalAmount + serviceFee);
      tx.status = "failed";
      tx.failureReason = "Service temporarily unavailable";
      tx.processedAt = new Date();
    } else if (paymentResponse.success && paymentResponse.status === "success") {
      // If you insist on "instant success" here, uncomment next two lines:
      // tx.status = "successful";
      // tx.processedAt = new Date();
      // Recommended: leave as "processing" and let webhook finalize.
      tx.status = "processing";
    } else if (paymentResponse.success) {
      tx.status = "processing";
    } else {
      // Explicit failure: refund amount+fee (OPTION B)
      promoterWallet.balance += (withdrawalAmount + serviceFee);
      tx.status = "failed";
      tx.failureReason = paymentResponse.message || "Payment failed";
      tx.processedAt = new Date();
    }

    cleanInvalidTransactionIds(promoterWallet);
    await user.save({ session });
    await session.commitTransaction();

    // Emails optional — keep as-is or comment out if you prefer to send only on webhook success/failure
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
          refundedAmount: (withdrawalAmount + serviceFee),    // OPTION B
          newBalance: promoterWallet.balance,
        });
        await sendEmail(user.email, "Withdrawal Failed - MarketSpase", emailContent);
      }
    } catch (err) {
      console.error("Failed to send email:", err);
    }

    return res.status(200).json({
      message:
        tx.status === "successful" ? "Withdrawal successful!"
      : tx.status === "failed"     ? "Withdrawal failed!"
      : "Withdrawal request processed.",
      success: true,
      data: { balance: promoterWallet.balance, transaction: tx },
    });

  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    console.error("Error during withdrawal request:", error);
    return res.status(500).json({ message: "An unexpected error occurred during withdrawal processing.", success: false });
  } finally {
    session.endSession();
  }
};