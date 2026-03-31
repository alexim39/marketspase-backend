// reject-withdrawal.controller.js
import { UserModel } from '../../user/models/user/index.js';

export const rejectWithdrawal = async (req, res) => {
  try {
    const { withdrawalId } = req.params;
    const { notes } = req.body;
    const adminUser = req.user?.displayName || 'System Admin';

    //console.log(`Rejecting withdrawal ID: ${withdrawalId} by admin: ${adminUser}`);

    if (!notes) {
      return res.status(400).json({
        success: false,
        message: 'Rejection notes are required',
      });
    }

    // Find user with this withdrawal transaction (promoter only)
    const user = await UserModel.findOne({
      'wallets.promoter.transactions._id': withdrawalId
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal request not found',
      });
    }

    // Find the transaction in promoter wallet
    let transactionIndex = -1;
    let transaction = null;

    if (user.wallets.promoter.transactions) {
      transactionIndex = user.wallets.promoter.transactions.findIndex(
        (t) => t._id.toString() === withdrawalId
      );
      
      if (transactionIndex !== -1) {
        transaction = user.wallets.promoter.transactions[transactionIndex];
      }
    }

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal transaction not found',
      });
    }

    // VALIDATION: Ensure this is actually a withdrawal request
    if (transaction.category !== 'withdrawal') {
      return res.status(400).json({
        success: false,
        message: `This transaction is not a withdrawal request. Category: ${transaction.category}`
      });
    }

    // VALIDATION: Check if transaction is already processed
    if (transaction.status === 'rejected' || transaction.status === 'approved') {
      return res.status(400).json({
        success: false,
        message: `This withdrawal has already been ${transaction.status}`
      });
    }

    // VALIDATION: Ensure withdrawal is in processing status (same as approve)
    if (transaction.status !== 'processing') {
      return res.status(400).json({
        success: false,
        message: `Cannot reject withdrawal with status: ${transaction.status}`
      });
    }

    const transactionAmount = transaction.amount;
    const currentBalance = user.wallets.promoter.balance;

    // Update transaction status to rejected
    user.wallets.promoter.transactions[transactionIndex].status = 'rejected';
    user.wallets.promoter.transactions[transactionIndex].processedAt = new Date();
    user.wallets.promoter.transactions[transactionIndex].notes = notes;

    // CRITICAL: Refund the amount back to promoter's available balance
    // Since funds were deducted when the withdrawal was requested, we need to return them
    user.wallets.promoter.balance += transactionAmount;

    await user.save();

    // Log activity
    await user.logActivity(
      'withdrawal_rejected',
      `Withdrawal of ₦${transactionAmount} to ${transaction.bankDetails?.bank} rejected by admin`,
      {
        resourceType: 'transaction',
        resourceId: withdrawalId,
        metadata: {
          amount: transactionAmount,
          previousBalance: currentBalance,
          newBalance: user.wallets.promoter.balance,
          bank: transaction.bankDetails?.bank,
          accountNumber: transaction.bankDetails?.accountNumber,
          accountName: transaction.bankDetails?.accountName,
          rejectedBy: adminUser,
          notes,
        },
      }
    );

    res.json({
      success: true,
      message: 'Withdrawal rejected successfully',
      data: {
        id: withdrawalId,
        amount: transactionAmount,
        status: 'rejected',
        previousBalance: currentBalance,
        newBalance: user.wallets.promoter.balance,
        bankDetails: {
          bank: transaction.bankDetails?.bank,
          accountName: transaction.bankDetails?.accountName,
          accountNumber: transaction.bankDetails?.accountNumber
        },
        processedAt: new Date(),
        processedBy: adminUser,
        notes,
      },
    });
  } catch (error) {
    console.error('Error rejecting withdrawal:', error);
    res.status(500).json({
      success: false,
      message: 'Error rejecting withdrawal',
    });
  }
};