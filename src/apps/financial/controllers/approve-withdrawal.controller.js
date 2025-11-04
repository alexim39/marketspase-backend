import { UserModel } from '../../user/models/user.model.js';
import { CampaignModel } from '../../campaign/models/campaign.model.js';
import { PromotionModel } from '../../promotion/models/promotion.model.js';
import mongoose from 'mongoose';

export const approveWithdrawal = async (req, res) => {
  try {
    const { withdrawalId } = req.params;
    const { notes } = req.body;
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

    // Update transaction status
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

    // Update the transaction
    user.wallets[walletType].transactions[transactionIndex].status = 'approved';
    // user.wallets[walletType].transactions[transactionIndex].status = 'approved';
    user.wallets[walletType].transactions[transactionIndex].processedAt = new Date();
    
    // Deduct from wallet balance
    const transactionAmount = user.wallets[walletType].transactions[transactionIndex].amount;
    user.wallets[walletType].balance -= transactionAmount;

    await user.save();

    // Log activity
    await user.logActivity('withdrawal_approved', `Withdrawal of ₦${transactionAmount} approved by admin`, {
      resourceType: 'transaction',
      resourceId: withdrawalId,
      metadata: {
        amount: transactionAmount,
        approvedBy: adminUser,
        notes
      }
    });

    res.json({
      success: true,
      message: 'Withdrawal approved successfully',
      data: {
        id: withdrawalId,
        status: 'approved',
        processedAt: new Date(),
        processedBy: adminUser
      }
    });
  } catch (error) {
    console.error('Error approving withdrawal:', error);
    res.status(500).json({
      success: false,
      message: 'Error approving withdrawal'
    });
  }
};