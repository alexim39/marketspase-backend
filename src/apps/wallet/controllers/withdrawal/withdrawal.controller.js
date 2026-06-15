// controllers/withdrawal.controller.js
import { UserModel } from '../../../user/models/user/index.js';
import { sendEmail } from "../../../../core/email.service.js";
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { assertAccountNotUsedByAnotherUser } from '../../services/account-ownership.service.js';
import { withdrawalSuccessfulTemplate } from '../../services/email/withdrawalSuccessfulTemplate.js';
import { withdrawalFailedTemplate } from '../../services/email/withdrawalFailedTemplate.js';
import { getVerificationLevel } from '../../services/get-verify-level.service.js';
import { processPayment, checkPaystackBalance } from '../../services/process-payment.js';
import {
  buildSignedQuote,
  convertAmount,
  getPaymentCurrencyConfig,
  normalizeCurrencyCode,
  roundCurrencyAmount,
  verifySignedQuote,
} from '../../services/payment-currency.service.js';
import {
  applyWalletCredit,
  applyWalletDebit,
  ensureWalletCurrencyState,
  getWalletAmountForCurrency,
} from '../../services/wallet-ledger.service.js';

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

/**
 * Generates a unique withdrawal reference.
 * Uses timestamp + random suffix for uniqueness.
 */
const generateReference = () => `WD_${Date.now()}_${Math.random().toString(36).slice(2, 15)}`;

/**
 * Refunds a wallet by the gross amount and marks the transaction as failed.
 * Uses the wallet object directly — caller must save afterwards.
 */
const refundWalletForFailedTransfer = (userWallet, txRef, grossAmount, withdrawalCurrency, grossBaseAmount, reason) => {
  applyWalletCredit(userWallet, {
    bucket: 'balance',
    amount: grossAmount,
    currency: withdrawalCurrency,
    baseAmount: grossBaseAmount,
    baseCurrency: userWallet.baseCurrency || 'NGN',
  });
  txRef.status = 'failed';
  txRef.failureReason = reason;
  txRef.processedAt = new Date();
};

export const withdrawRequest = async (req, res) => {
  const {
    bank,
    accountNumber,
    accountName,
    amount,
    saveAccount,
    bankName,
    role,
    payableAmount,
    bankCode,
    currency,
    finalAmount,
    quote,
    idempotencyKey,
  } = req.body;
  const userId = req.userId;
  const requestedAmount = asNumber(amount);
  const requestedPayableAmount = asNumber(payableAmount);
  const requestedFinalAmount = asNumber(finalAmount ?? amount);

  if (!userId || !amount || !bank || !accountNumber || !accountName) {
    return res.status(400).json({
      message: "Missing required fields.",
      success: false,
      code: "MISSING_REQUIRED_FIELDS",
    });
  }

  if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
    return res.status(400).json({
      message: "Invalid withdrawal amount.",
      success: false,
      code: "INVALID_AMOUNT",
    });
  }

  if (!Number.isFinite(requestedPayableAmount) || requestedPayableAmount < 0) {
    return res.status(400).json({
      message: "Invalid payable amount.",
      success: false,
      code: "INVALID_PAYABLE_AMOUNT",
    });
  }

  if (!['promoter', 'marketer'].includes(role)) {
    return res.status(400).json({
      message: "Invalid wallet role selected for withdrawal.",
      success: false,
      code: "INVALID_WALLET_ROLE",
    });
  }

  const reference = generateReference();

  try {
    // 1) Load user & basic checks
    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        message: "User not found", 
        success: false 
      });
    }
    
    if (!user.isActive || user.isDeleted) {
      return res.status(403).json({ 
        message: "Account inactive or deleted.", 
        success: false 
      });
    }

    // 2) Idempotency check — prevent duplicate Paystack transfers
    if (idempotencyKey) {
      const existing = await UserModel.findOne({
        _id: userId,
        $or: [
          { 'wallets.promoter.transactions.idempotencyKey': idempotencyKey },
          { 'wallets.marketer.transactions.idempotencyKey': idempotencyKey },
        ],
      });
      if (existing) {
        const wallet = role === 'promoter' ? existing.wallets.promoter : existing.wallets.marketer;
        const tx = wallet.transactions.find(t => t.idempotencyKey === idempotencyKey);
        return res.status(200).json({
          success: true,
          message: tx?.status === 'failed'
            ? 'A previous withdrawal failed. Please try again with a new request.'
            : 'Withdrawal is already being processed.',
          data: {
            balance: wallet.balance,
            transaction: tx || null,
            duplicate: true,
          },
          code: tx?.status === 'failed' ? 'PREVIOUS_FAILED' : 'DUPLICATE_REQUEST',
        });
      }
    }

    // 3) Bank ownership guard
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

    // 4) Verification
    const verificationLevel = getVerificationLevel(user, accountNumber, accountName);
    if (verificationLevel === "unverified") {
      return res.status(403).json({
        message: "Account ownership verification failed.",
        success: false,
        code: "ACCOUNT_OWNERSHIP_VERIFICATION_FAILED",
      });
    }

    // 5) Balance check & fee calculation
    let userWallet; 
    let serviceFee;
    const withdrawalCurrency = normalizeCurrencyCode(currency || 'NGN');
    const settlementCurrency = 'NGN';
    const config = await getPaymentCurrencyConfig();
    const selectedCurrencyConfig = config.supportedCurrencies.find(
      (item) => item.code === withdrawalCurrency,
    );

    if (!selectedCurrencyConfig?.capabilities?.withdrawal) {
      return res.status(400).json({
        success: false,
        message: `${withdrawalCurrency} is not enabled for withdrawals.`,
        code: "WITHDRAWAL_CURRENCY_NOT_SUPPORTED",
      });
    }

    if (role === 'promoter') {
      serviceFee = roundCurrencyAmount(requestedFinalAmount * 0.20);
      const amountPayable = roundCurrencyAmount(requestedFinalAmount - serviceFee);

      userWallet = user.wallets.promoter; 
      ensureWalletCurrencyState(userWallet, userWallet.baseCurrency || 'NGN');
      
      if (getWalletAmountForCurrency(userWallet, 'balance', withdrawalCurrency) < requestedAmount) {
        return res.status(400).json({
          message: `Insufficient balance in ${withdrawalCurrency}.`,
          success: false,
          code: "INSUFFICIENT_SOURCE_BALANCE",
        });
      }
      
      if (Math.abs(amountPayable - requestedPayableAmount) > 1) {
        return res.status(400).json({ message: "invalid withdrawal amount or service charge must apply.", success: false });
      }
    }

    if (role === 'marketer') {
      serviceFee = 0;
      const amountPayable = roundCurrencyAmount(requestedFinalAmount - serviceFee);

      userWallet = user.wallets.marketer; 
      ensureWalletCurrencyState(userWallet, userWallet.baseCurrency || 'NGN');
      
      if (getWalletAmountForCurrency(userWallet, 'balance', withdrawalCurrency) < requestedAmount) {
        return res.status(400).json({
          message: `Insufficient balance in ${withdrawalCurrency}.`,
          success: false,
          code: "INSUFFICIENT_SOURCE_BALANCE",
        });
      }

      if (Math.abs(amountPayable - requestedPayableAmount) > 1) {
        return res.status(400).json({ message: "invalid withdrawal amount.", success: false });
      }
    }

    const grossAmount = roundCurrencyAmount(requestedAmount);
    const netSourceAmount = roundCurrencyAmount(requestedPayableAmount);
    const grossBaseAmount = roundCurrencyAmount(convertAmount(
      grossAmount,
      withdrawalCurrency,
      userWallet.baseCurrency || 'NGN',
      config,
    ).amount);

    const verifiedQuote = quote
      ? await verifySignedQuote(quote, { purpose: 'wallet_withdrawal' })
      : await buildSignedQuote({
          amount: netSourceAmount,
          fromCurrency: withdrawalCurrency,
          toCurrency: settlementCurrency,
          purpose: 'wallet_withdrawal',
        });

    if (normalizeCurrencyCode(verifiedQuote.sourceCurrency) !== withdrawalCurrency) {
      return res.status(400).json({
        success: false,
        message: 'Withdrawal quote currency does not match the selected source currency.',
      });
    }

    if (Math.abs(Number(verifiedQuote.sourceAmount || 0) - netSourceAmount) > 1) {
      return res.status(400).json({
        success: false,
        message: 'Withdrawal quote amount is no longer valid. Please refresh the withdrawal screen.',
      });
    }

    const settlementAmount = roundCurrencyAmount(verifiedQuote.targetAmount);

    // Check Paystack balance (non-blocking)
    const balanceCheck = await checkPaystackBalance(settlementCurrency);
    if (!balanceCheck.success || balanceCheck.balance < settlementAmount) {
      console.warn('Paystack balance warning:', balanceCheck);
    }

    // ─────────────────────────────────────────────────────────────────
    // CRITICAL: Deduct wallet AND save BEFORE calling Paystack
    // This ensures funds are locked before any external transfer.
    // Previously the save happened AFTER Paystack, allowing double-spend.
    // ─────────────────────────────────────────────────────────────────

    applyWalletDebit(userWallet, {
      bucket: 'balance',
      amount: grossAmount,
      currency: withdrawalCurrency,
      baseAmount: grossBaseAmount,
      baseCurrency: userWallet.baseCurrency || 'NGN',
    });

    // Create transaction record
    const tx = {
      reference,
      idempotencyKey: idempotencyKey || undefined,
      gateway: "paystack",
      currency: withdrawalCurrency,
      baseCurrency: userWallet.baseCurrency || 'NGN',
      baseAmount: grossBaseAmount,
      settlementCurrency,
      fee: serviceFee,
      transferCode: undefined,
      failureReason: undefined,
      amount: grossAmount,
      amountPayable: netSourceAmount,
      settlementAmount,
      exchangeRate: Number(verifiedQuote.exchangeRate || 1),
      type: "debit",
      category: "withdrawal",
      description: `MarketSpase withdrawal to ${bankName || bank} ending in ${accountNumber.slice(-4)}`,
      status: "processing",
      createdAt: new Date(),
      processedAt: null,
      providerReference: undefined,
      bankDetails: { 
        bank: bankName || bank, 
        bankCode: bank, 
        accountNumber, 
        accountName 
      },
      meta: { 
        createdBy: "withdrawRequest", 
        verifyLevel: verificationLevel,
        requestIp: req.ip,
        userAgent: req.get('User-Agent'),
        quote: verifiedQuote,
      },
    };

    userWallet.transactions.push(tx);
    const txRef = userWallet.transactions[userWallet.transactions.length - 1];

    // === SAVE WALLET DEDUCTION BEFORE PAYSTACK ===
    cleanInvalidTransactionIds(userWallet);
    await user.save();

    // === NOW CALL PAYSTACK ===
    const paymentResponse = await processPayment(
      bank,
      accountNumber,
      accountName,
      settlementAmount,
      { 
        userId, 
        reason: `MarketSpase withdrawal to ${accountName}`, 
        reference: txRef.reference 
      },
      settlementCurrency,
    );

    // Reload user from DB to get the latest saved state for update
    const updatedUser = await UserModel.findById(userId);
    const updatedWallet = role === 'promoter' ? updatedUser.wallets.promoter : updatedUser.wallets.marketer;
    const updatedTxRef = updatedWallet.transactions.find(t => t.reference === reference);

    if (!updatedTxRef) {
      // Transaction was not found — this shouldn't happen but we must handle it
      console.error('CRITICAL: Paystack transfer created but transaction not found in DB for reference:', reference);
      // Refund on the reloaded user
      applyWalletCredit(updatedWallet, {
        bucket: 'balance',
        amount: grossAmount,
        currency: withdrawalCurrency,
        baseAmount: grossBaseAmount,
        baseCurrency: updatedWallet.baseCurrency || 'NGN',
      });
      await updatedUser.save();
      return res.status(500).json({
        success: false,
        message: 'Internal error. Please contact support with reference: ' + reference,
        code: 'TRANSACTION_NOT_FOUND_AFTER_PAYSTACK',
      });
    }

    // Store Paystack identifiers
    if (paymentResponse.providerReference) {
      updatedTxRef.providerReference = paymentResponse.providerReference;
    }
    if (paymentResponse.transferCode) {
      updatedTxRef.transferCode = paymentResponse.transferCode;
    }

    updatedTxRef.meta.processPayment = {
      success: paymentResponse.success,
      status: paymentResponse.status,
      message: paymentResponse.message,
      providerReference: paymentResponse.providerReference,
      transferCode: paymentResponse.transferCode,
      timestamp: new Date(),
      fullResponse: paymentResponse.data,
    };

    // Handle blocked transfer
    if (paymentResponse.status === "blocked" || paymentResponse.data?.status === "blocked") {
      refundWalletForFailedTransfer(updatedWallet, updatedTxRef, grossAmount, withdrawalCurrency, grossBaseAmount,
        'Transfer blocked by provider');
      cleanInvalidTransactionIds(updatedWallet);
      await updatedUser.save();
      return res.status(200).json({
        success: false,
        message: "Withdrawal failed (blocked).",
        data: { balance: updatedWallet.balance, transaction: updatedTxRef },
      });
    }

    // Handle Paystack failure
    if (!paymentResponse.success) {
      refundWalletForFailedTransfer(updatedWallet, updatedTxRef, grossAmount, withdrawalCurrency, grossBaseAmount,
        paymentResponse.message || 'Transfer failed');
      cleanInvalidTransactionIds(updatedWallet);
      await updatedUser.save();
      return res.status(200).json({
        success: false,
        message: "Withdrawal failed: " + (paymentResponse.message || "Unknown error"),
        data: { 
          balance: updatedWallet.balance, 
          transaction: updatedTxRef,
          refunded: true
        },
      });
    }

    // Handle immediate success
    if (paymentResponse.status === 'success') {
      updatedTxRef.status = "successful";
      updatedTxRef.processedAt = new Date();
    } else {
      updatedTxRef.status = "processing";
    }

    // Save bank account if requested
    if (saveAccount) {
      const saved = updatedUser.savedAccounts.find(
        a => a.accountNumber === accountNumber && a.bankCode === bank
      );
      if (!saved) {
        updatedUser.savedAccounts.push({
          bank: bankName || bank,
          bankCode: bank,
          accountNumber,
          accountName,
          verified: true,
          verifiedAt: new Date(),
          firstUsed: new Date(),
          lastUsed: new Date(),
          recipientCode: paymentResponse.data?.recipient?.recipient_code,
        });
      } else {
        saved.lastUsed = new Date();
        if (paymentResponse.data?.recipient?.recipient_code) {
          saved.recipientCode = paymentResponse.data.recipient.recipient_code;
        }
      }
    }

    cleanInvalidTransactionIds(updatedWallet);
    await updatedUser.save();

    return res.status(200).json({
      message: paymentResponse.status === 'success' 
        ? "Withdrawal completed successfully." 
        : "Withdrawal request is being processed.",
      success: true,
      data: { 
        balance: updatedWallet.balance, 
        transaction: updatedTxRef,
        status: updatedTxRef.status,
        providerStatus: paymentResponse.status
      },
    });

  } catch (error) {
    console.error("Withdrawal error:", error);

    if (error?.status && error.status < 500) {
      return res.status(error.status).json({
        success: false,
        message: error.message || "Withdrawal request could not be processed.",
        code: "WITHDRAWAL_VALIDATION_FAILED",
      });
    }
    
    // Attempt to refund if the wallet was already deducted (use the KNOWN reference)
    try {
      const user = await UserModel.findById(userId);
      if (!user) {
        return res.status(500).json({
          message: "Unexpected error occurred. Please try again.",
          success: false,
          code: "INTERNAL_SERVER_ERROR",
        });
      }

      const walletKey = role === 'promoter' ? 'promoter' : 'marketer';
      const userWallet = user.wallets[walletKey];
      if (!userWallet) {
        return res.status(500).json({
          message: "Unexpected error occurred. Please try again.",
          success: false,
          code: "INTERNAL_SERVER_ERROR",
        });
      }

      const transaction = userWallet.transactions.find(
        t => t.reference === reference
      );

      if (transaction && (transaction.status === 'processing' || transaction.status === 'pending')) {
        // Only reverse if the wallet was actually debited (status is processing/pending)
        userWallet.balance = roundCurrencyAmount(
          (Number(userWallet.balance || 0)) + (Number(transaction.amount || 0))
        );
        transaction.status = 'failed';
        transaction.failureReason = 'System error: ' + error.message;
        transaction.processedAt = new Date();
        cleanInvalidTransactionIds(userWallet);
        await user.save();
        console.log('Refunded withdrawal due to error, reference:', reference);
      }
    } catch (refundError) {
      console.error('CRITICAL: Failed to refund user after withdrawal error:', refundError);
    }

    return res.status(500).json({
      message: "Unexpected error occurred. Please try again.",
      success: false,
      code: "INTERNAL_SERVER_ERROR"
    });
  }
};
