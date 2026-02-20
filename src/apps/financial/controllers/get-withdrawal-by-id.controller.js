// src/apps/financial/controllers/get-withdrawal-by-id.controller.js
import { UserModel } from '../../user/models/user.model.js';
import mongoose from 'mongoose';

export const getWithdrawalById = async (req, res) => {
  try {
    const { withdrawalId } = req.params;

    console.log('id ',withdrawalId)

    if (!withdrawalId || !mongoose.Types.ObjectId.isValid(withdrawalId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid withdrawal ID format'
      });
    }

    // Find user containing this withdrawal
    const user = await UserModel.findOne({
      $or: [
        { 'wallets.promoter.transactions._id': new mongoose.Types.ObjectId(withdrawalId) },
        { 'wallets.marketer.transactions._id': new mongoose.Types.ObjectId(withdrawalId) }
      ]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal request not found'
      });
    }

    // Find the specific transaction in either wallet
    let transaction = null;
    let walletType = null;

    // Check promoter wallet
    if (user.wallets?.promoter?.transactions) {
      transaction = user.wallets.promoter.transactions.find(
        tx => tx._id.toString() === withdrawalId && tx.category === 'withdrawal'
      );
      if (transaction) walletType = 'promoter';
    }

    // Check marketer wallet if not found
    if (!transaction && user.wallets?.marketer?.transactions) {
      transaction = user.wallets.marketer.transactions.find(
        tx => tx._id.toString() === withdrawalId && tx.category === 'withdrawal'
      );
      if (transaction) walletType = 'marketer';
    }

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal transaction not found'
      });
    }

    // Extract bank details
    const bank = transaction.bankDetails || {};

    // Format response
    const withdrawalRequest = {
      withdrawalId: transaction._id.toString(),
      userId: user._id.toString(),
      userName: user.displayName || user.username || 'N/A',
      userEmail: user.email || '',
      userRole: user.role || (walletType === 'promoter' ? 'promoter' : 'marketer'),
      amount: transaction.amount || 0,
      amountPayable: transaction.amountPayable || 0,
      fee: transaction.fee || 0,
      bankName: bank.bank || 'N/A',
      bankCode: bank.bankCode || '',
      accountNumber: bank.accountNumber || '',
      accountName: bank.accountName || '',
      status: transaction.status || 'unknown',
      createdAt: transaction.createdAt || new Date(),
      processedAt: transaction.processedAt || null,
      processedBy: transaction.meta?.processedBy || null,
      notes: transaction.meta?.notes || null,
      walletType: walletType || 'promoter',
      reference: transaction.reference || '',
      providerReference: transaction.providerReference || '',
      transferCode: transaction.transferCode || '',
      failureReason: transaction.failureReason || null,
      meta: transaction.meta || {},
      timeline: {
        created: transaction.createdAt,
        processed: transaction.processedAt,
        webhookReceived: transaction.meta?.webhook?.receivedAt || null,
        lastSynced: transaction.meta?.syncUpdate?.syncedAt || null
      }
    };

    // If there's a webhook event, include the latest one
    if (transaction.meta?.webhook) {
      withdrawalRequest.lastWebhookEvent = transaction.meta.webhook;
    }

    // If there are multiple webhook events, include the last few
    if (transaction.meta?.webhookHistory && Array.isArray(transaction.meta.webhookHistory)) {
      withdrawalRequest.webhookHistory = transaction.meta.webhookHistory.slice(-5); // Last 5 events
    }

    res.json({
      success: true,
      data: withdrawalRequest
    });

  } catch (error) {
    console.error('Error in getWithdrawalById:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching withdrawal request',
      error: error.message
    });
  }
};