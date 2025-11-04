// admin-financial.controller.js
import { UserModel } from '../../user/models/user.model.js';
import { CampaignModel } from '../../campaign/models/campaign.model.js';
import { PromotionModel } from '../../promotion/models/promotion.model.js';
import mongoose from 'mongoose';
import { transformTransaction } from '../services/transform-transaction.service.js';



export const processWithdrawal = async (req, res) => {
  try {
    const { withdrawalId } = req.params;
    const adminUser = req.user?.displayName || 'System Admin';

    // Find user with this withdrawal transaction
    const user = await UserModel.findOne({
      $or: [
        { 'wallets.promoter.transactions._id': withdrawalId },
        { 'wallets.marketer.transactions._id': withdrawalId }
      ]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal request not found'
      });
    }

    // Update transaction status to processing
    let walletType = '';
    let transactionIndex = -1;

    // Check promoter wallet
    if (user.wallets.promoter.transactions) {
      transactionIndex = user.wallets.promoter.transactions.findIndex(
        t => t._id.toString() === withdrawalId
      );
      if (transactionIndex !== -1) {
        walletType = 'promoter';
      }
    }

    // Check marketer wallet if not found in promoter
    if (transactionIndex === -1 && user.wallets.marketer.transactions) {
      transactionIndex = user.wallets.marketer.transactions.findIndex(
        t => t._id.toString() === withdrawalId
      );
      if (transactionIndex !== -1) {
        walletType = 'marketer';
      }
    }

    if (transactionIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal transaction not found'
      });
    }

    // Update the transaction status
    user.wallets[walletType].transactions[transactionIndex].status = 'processing';
    user.wallets[walletType].transactions[transactionIndex].processedAt = new Date();

    await user.save();

    // Log activity
    const transactionAmount = user.wallets[walletType].transactions[transactionIndex].amount;
    await user.logActivity('withdrawal_processing', `Withdrawal of ₦${transactionAmount} marked as processing`, {
      resourceType: 'transaction',
      resourceId: withdrawalId,
      metadata: {
        amount: transactionAmount,
        processedBy: adminUser
      }
    });

    res.json({
      success: true,
      message: 'Withdrawal marked as processing',
      data: {
        id: withdrawalId,
        status: 'processing',
        processedAt: new Date(),
        processedBy: adminUser
      }
    });
  } catch (error) {
    console.error('Error processing withdrawal:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing withdrawal'
    });
  }
};