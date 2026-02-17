// src/payments/controllers/withdraw.controller.js
import crypto from "crypto";
import { PAYMENT_CONFIG } from "../../../payments/config.js";
import { UserModel } from '../../../user/models/user.model.js';
import { processPayment } from "../../../payments/services/process-payment.js";

function toKobo(naira) {
  return Math.round(Number(naira) * 100);
}

function makeReference(prefix = "wd") {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
}

export async function withdrawRequest(req, res) {
  try {
    const {
      saveAccount,
      bankName,
      bankCode,
      bank,
      accountNumber,
      accountName,
      amount,
      userId,
    } = req.body || {};

    if (!userId || !bankCode || !accountNumber || !accountName) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const amountKobo = toKobo(amount);
    if (!amountKobo || amountKobo <= 0) {
      return res.status(400).json({ success: false, message: "Invalid amount" });
    }

    // Load user + promoter wallet
    const user = await UserModel.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const wallet = user.wallets?.promoter;
    if (!wallet) return res.status(400).json({ success: false, message: "Promoter wallet not found" });

    // Fee is deducted ONLY on success in finalizeTransfer, so we must ensure user can afford it.
    const grossKobo = toKobo(amount);
    const feeKobo = Math.round(grossKobo * PAYMENT_CONFIG.withdrawalFeePercent);
    const netKobo = grossKobo - feeKobo;

    // User only needs gross amount available
    if (wallet.balance < grossKobo) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Need ${(grossKobo / 100).toFixed(2)} NGN.`,
        data: { balance: wallet.balance / 100, required: grossKobo / 100 }
      });
    }

    // Idempotency: if client sends an Idempotency-Key header you can use it as reference.
    const reference = (req.headers["idempotency-key"] || "").trim() || makeReference("wd");

    // Prevent duplicate reference within promoter wallet (you already index references) [12](https://saipem-my.sharepoint.com/personal/alex_imenwo_saipem_com1/Documents/Microsoft%20Copilot%20Chat%20Files/user.model.js)
    const existing = wallet.transactions.find(t => t.reference === reference);
    if (existing) {
      return res.status(200).json({
        success: true,
        message: "Withdrawal already initiated",
        data: { reference, status: existing.status, transferCode: existing.transferCode || null }
      });
    }

    // 1) Create tx record FIRST (engine finalizer searches by reference) [7](https://saipem-my.sharepoint.com/personal/alex_imenwo_saipem_com1/Documents/Microsoft%20Copilot%20Chat%20Files/finalize.js)[10](https://saipem-my.sharepoint.com/personal/alex_imenwo_saipem_com1/Documents/Microsoft%20Copilot%20Chat%20Files/transaction.schema.js)
    const tx = {
      reference,
      gateway: "paystack",
      currency: wallet.currency || "NGN",
      amount: amountKobo,
      amountPayable: amountKobo, // in your current design user receives gross; fee is separate [7](https://saipem-my.sharepoint.com/personal/alex_imenwo_saipem_com1/Documents/Microsoft%20Copilot%20Chat%20Files/finalize.js)
      type: "debit",
      category: "withdrawal",
      description: `Withdrawal to bank (${bankName || bankCode})`,
      status: "initiated",
      bankDetails: {
        bank: bankName || bank || "",
        bankCode: bankCode,
        accountNumber,
        accountName
      },
      meta: {
        saveAccount: !!saveAccount,
        // keep any UI fields for display/debug (but do not trust them for math)
        ui: { bankName, bankCode, accountNumber, accountName, amount }
      }
    };

    wallet.transactions.unshift(tx);

    // 2) Deduct gross amount immediately (the "hold")
    wallet.balance -= amountKobo;

    await user.save();

    // 3) Call Paystack transfer initiation (engine will finalize via webhook/recon later) [8](https://saipem-my.sharepoint.com/personal/alex_imenwo_saipem_com1/Documents/Microsoft%20Copilot%20Chat%20Files/process-payment.js)[4](https://saipem-my.sharepoint.com/personal/alex_imenwo_saipem_com1/Documents/Microsoft%20Copilot%20Chat%20Files/transfer.js)[3](https://saipem-my.sharepoint.com/personal/alex_imenwo_saipem_com1/Documents/Microsoft%20Copilot%20Chat%20Files/reconcileWithdrawals.js)
    const payRes = await processPayment(bankCode, accountNumber, accountName, netKobo, {
      userId,
      reason: "Promoter Withdrawal - MarketSpase",
      reference
    });

    // 4) Update tx with provider results (transferCode is useful for recon fallback) [3](https://saipem-my.sharepoint.com/personal/alex_imenwo_saipem_com1/Documents/Microsoft%20Copilot%20Chat%20Files/reconcileWithdrawals.js)[8](https://saipem-my.sharepoint.com/personal/alex_imenwo_saipem_com1/Documents/Microsoft%20Copilot%20Chat%20Files/process-payment.js)
    const savedTx = wallet.transactions.find(t => t.reference === reference);
    if (savedTx) {
      savedTx.status = payRes.success ? "processing" : "failed";
      savedTx.transferCode = payRes.transferCode || savedTx.transferCode;
      savedTx.meta = { ...(savedTx.meta || {}), initiation: payRes };
      if (!payRes.success) {
        // If initiation failed immediately, refund gross now (since Paystack won’t send success webhook)
        wallet.balance += amountKobo;
      }
      await user.save();
    }

    return res.status(200).json({
      success: payRes.success,
      message: payRes.success ? "Withdrawal initiated" : (payRes.message || "Withdrawal failed"),
      data: {
        reference,
        status: payRes.success ? "processing" : "failed",
        transferCode: payRes.transferCode || null,
        // Fee is applied by finalizeTransfer only when Paystack confirms success [7](https://saipem-my.sharepoint.com/personal/alex_imenwo_saipem_com1/Documents/Microsoft%20Copilot%20Chat%20Files/finalize.js)
        expectedFee: expectedFee / 100,
        grossAmount: amountKobo / 100
      }
    });
  } catch (err) {
    console.error("requestWithdrawal error:", err?.response?.data || err?.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}