// controllers/withdrawal.controller.js
import { UserModel } from '../../../user/models/user.model.js';
import { sendEmail } from "../../../../services/email.service.js";
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { assertAccountNotUsedByAnotherUser } from '../../services/account-ownership.service.js';
import { withdrawalSuccessfulTemplate } from '../../services/email/withdrawalSuccessfulTemplate.js';
import { withdrawalFailedTemplate } from '../../services/email/withdrawalFailedTemplate.js';
import { getVerificationLevel } from '../../services/get-verify-level.service.js';
import { processPayment, checkPaystackBalance } from '../../services/process-payment.js';

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
    amount,
    userId,
    saveAccount,
    bankName,
    role,
    payableAmount,
    bankCode,
    currency,
    finalAmount
  } = req.body;

  //console.log('Withdrawal request body:', req.body);

  if (!userId || !amount || !bank || !accountNumber || !accountName) {
    return res.status(400).json({
      message: "Missing required fields.",
      success: false,
      code: "MISSING_REQUIRED_FIELDS",
    });
  }

  if (Number.isNaN(amount) || amount <= 0) {
    return res.status(400).json({
      message: "Invalid withdrawal amount.",
      success: false,
      code: "INVALID_AMOUNT",
    });
  }

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

    // 2) Optional: Check Paystack balance before proceeding
    const balanceCheck = await checkPaystackBalance();
    if (!balanceCheck.success || balanceCheck.balance < payableAmount) {
      console.warn('Paystack balance warning:', balanceCheck);
      // Continue anyway - webhook will handle failure if insufficient
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

    // 5) Balance check & initial deduction

    let userWallet; 
    let serviceFee;

    if (role === 'promoter') {
      serviceFee = Math.round(finalAmount * 0.20);
      const amountPayable = finalAmount - serviceFee;

      userWallet = user.wallets.promoter; 
      
      if (userWallet.balance < amount) {
        return res.status(400).json({ message: "Insufficient balance.", success: false });
      }
      
      if (amountPayable !== payableAmount) {
        return res.status(400).json({ message: "invalid withdrawal amount or service charge must apply.", success: false });
      }
    }

    if (role === 'marketer') {
      serviceFee = 0;
      const amountPayable = finalAmount - serviceFee;

      userWallet = user.wallets.marketer; 
      
      if (userWallet.balance < amount) {
        return res.status(400).json({ message: "Insufficient balance.", success: false });
      }

      if (amountPayable !== payableAmount) {
        return res.status(400).json({ message: "invalid withdrawal amount.", success: false });
      }
    }

    
    // Deduct gross amount from user balance
    userWallet.balance -= amount;

    // 6) Create transaction
    const tx = {
      reference: `WD_${Date.now()}_${Math.random().toString(36).slice(2, 15)}`,
      gateway: "paystack",
      currency: "NGN",
      fee: serviceFee,
      transferCode: undefined,
      failureReason: undefined,
      amount,
      amountPayable: payableAmount,
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
        userAgent: req.get('User-Agent')
      },
    };

    userWallet.transactions.push(tx);
    const txRef = userWallet.transactions[userWallet.transactions.length - 1];

    // 7) Process payment through Paystack
    //console.log('Initiating payment with reference:', txRef.reference);
    const paymentResponse = await processPayment(
      bank,
      accountNumber,
      accountName,
      payableAmount,
      { 
        userId, 
        reason: `MarketSpase withdrawal to ${accountName}`, 
        reference: txRef.reference 
      }
    );

    // console.log('🔵 PAYMENT RESPONSE DETAILS:', {
    //   success: paymentResponse.success,
    //   status: paymentResponse.status,
    //   reference: paymentResponse.reference,
    //   providerReference: paymentResponse.providerReference,
    //   transferCode: paymentResponse.transferCode,
    //   message: paymentResponse.message
    // });

    // Store ALL provider identifiers for recon
    if (paymentResponse.reference) {
      txRef.reference = paymentResponse.reference; // Update with our reference (should be same)
    }
    if (paymentResponse.providerReference) {
      txRef.providerReference = paymentResponse.providerReference; // Paystack's reference
    }
    if (paymentResponse.transferCode) {
      txRef.transferCode = paymentResponse.transferCode;
    }

    // Store the full response in meta
   txRef.meta.processPayment = {
    success: paymentResponse.success,
    status: paymentResponse.status,
    message: paymentResponse.message,
    providerReference: paymentResponse.providerReference,
    transferCode: paymentResponse.transferCode,
    timestamp: new Date(),
    fullResponse: paymentResponse.data // Store full response for debugging
  };

  // Check if transfer was blocked
  if (paymentResponse.status === "blocked" || paymentResponse.data?.status === "blocked") {
    // Refund gross
    userWallet.balance += amount;
    txRef.status = "failed";
    txRef.failureReason = "Transfer blocked by provider";
    txRef.processedAt = new Date();
    cleanInvalidTransactionIds(userWallet);
    await user.save();
    
    return res.status(200).json({
      success: false,
      message: "Withdrawal failed (blocked).",
      data: { balance: userWallet.balance, transaction: txRef },
    });
  }

    // Handle immediate failures
    if (!paymentResponse.success) {
      // Refund the user
      userWallet.balance += amount;
      txRef.status = "failed";
      txRef.failureReason = paymentResponse.message || "Transfer failed";
      txRef.processedAt = new Date();
      
      cleanInvalidTransactionIds(userWallet);
      await user.save();

      // Send failure notification
      // if (user.email) {
      //   try {
      //     const emailTemplate = withdrawalFailedTemplate(user);
      //     await sendEmail({
      //       to: user.email,
      //       subject: 'Withdrawal Failed - Funds Refunded',
      //       html: emailTemplate
      //     });
      //   } catch (emailError) {
      //     console.error('Failed to send failure email:', emailError);
      //   }
      // }

      return res.status(200).json({
        success: false,
        message: "Withdrawal failed: " + (paymentResponse.message || "Unknown error"),
        data: { 
          balance: userWallet.balance, 
          transaction: txRef,
          refunded: true
        },
      });
    }

    // If transfer was immediately successful (OTP disabled)
    if (paymentResponse.status === 'success') {
      txRef.status = "successful";
      txRef.processedAt = new Date();
      
      // Send success email
      // if (user.email) {
      //   try {
      //     const emailTemplate = withdrawalSuccessfulTemplate(user);
      //     await sendEmail({
      //       to: user.email,
      //       subject: 'Withdrawal Successful',
      //       html: emailTemplate
      //     });
      //   } catch (emailError) {
      //     console.error('Failed to send success email:', emailError);
      //   }
      // }

      // Add to activity log
      await user.logActivity(
        'withdrawal_complete',
        `Withdrawal of ₦${(amount / 100).toFixed(2)} completed successfully`,
        {
          resourceType: 'withdrawal',
          metadata: {
            transactionId: txRef._id,
            reference: txRef.reference,
            amount: amount
          }
        }
      );
    } 
    // If still processing (fallback - but unlikely with OTP disabled)
    else {
      txRef.status = "processing";
    }

    // Save bank account if requested
    if (saveAccount) {
      const saved = user.savedAccounts.find(
        a => a.accountNumber === accountNumber && a.bankCode === bank
      );
      
      if (!saved) {
        user.savedAccounts.push({
          bank: bankName || bank,
          bankCode: bank,
          accountNumber,
          accountName,
          verified: true,
          verifiedAt: new Date(),
          firstUsed: new Date(),
          lastUsed: new Date(),
          recipientCode: paymentResponse.data?.recipient?.recipient_code // Save for future use
        });
      } else {
        saved.lastUsed = new Date();
        if (paymentResponse.data?.recipient?.recipient_code) {
          saved.recipientCode = paymentResponse.data.recipient.recipient_code;
        }
      }
    }

    cleanInvalidTransactionIds(userWallet);
    await user.save();

    return res.status(200).json({
      message: paymentResponse.status === 'success' 
        ? "Withdrawal completed successfully." 
        : "Withdrawal request is being processed.",
      success: true,
      data: { 
        balance: userWallet.balance, 
        transaction: txRef,
        status: txRef.status,
        providerStatus: paymentResponse.status
      },
    });

  } catch (error) {
    console.error("Withdrawal error:", error);
    
    // Attempt to refund if error occurred after deduction
    try {
      const user = await UserModel.findById(userId);
      if (user && user.wallets?.promoter) {
        const userWallet = user.wallets.promoter;
        const transaction = userWallet.transactions.find(
          t => t.reference === `WD_${Date.now()}_${Math.random().toString(36).slice(2, 15)}`
        );
        
        if (transaction && transaction.status === 'processing') {
          userWallet.balance += transaction.amount;
          transaction.status = 'failed';
          transaction.failureReason = 'System error: ' + error.message;
          await user.save();
        }
      }
    } catch (refundError) {
      console.error('Failed to refund user:', refundError);
    }

    return res.status(500).json({
      message: "Unexpected error occurred. Please try again.",
      success: false,
      code: "INTERNAL_SERVER_ERROR"
    });
  }
};