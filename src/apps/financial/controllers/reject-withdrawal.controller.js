// admin-financial.controller.js
import { UserModel } from '../../user/models/user.model.js';

export const rejectWithdrawal = async (req, res) => {
  try {
    const { withdrawalId } = req.params;
    const { notes } = req.body;
    const adminUser = req.user?.displayName || 'System Admin';

    if (!notes) {
      return res.status(400).json({
        success: false,
        message: 'Rejection notes are required',
      });
    }

    // Find user with this withdrawal transaction
    const user = await UserModel.findOne({
      $or: [
        { 'wallets.promoter.transactions._id': withdrawalId },
        { 'wallets.marketer.transactions._id': withdrawalId },
      ],
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal request not found',
      });
    }

    // Identify wallet type
    let walletType = '';
    let transactionIndex = -1;

    // Check promoter wallet
    if (user.wallets.promoter?.transactions?.length) {
      transactionIndex = user.wallets.promoter.transactions.findIndex(
        (t) => t._id.toString() === withdrawalId
      );
      if (transactionIndex !== -1) {
        walletType = 'promoter';
      }
    }

    // Check marketer wallet if not found in promoter
    if (transactionIndex === -1 && user.wallets.marketer?.transactions?.length) {
      transactionIndex = user.wallets.marketer.transactions.findIndex(
        (t) => t._id.toString() === withdrawalId
      );
      if (transactionIndex !== -1) {
        walletType = 'marketer';
      }
    }

    if (transactionIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal transaction not found',
      });
    }

    const transaction =
      user.wallets[walletType].transactions[transactionIndex];
    const transactionAmount = transaction.amount;

    // Update transaction details
    transaction.status = 'rejected';
    transaction.processedAt = new Date();
    transaction.notes = notes;

    // Release reserved funds
    user.wallets[walletType].reserved -= transactionAmount;

    // ✅ If promoter, return funds to balance
    if (walletType === 'promoter') {
      user.wallets.promoter.balance += transactionAmount;
    }

    await user.save();

    // Log activity
    await user.logActivity(
      'withdrawal_rejected',
      `Withdrawal of ₦${transactionAmount} rejected by admin`,
      {
        resourceType: 'transaction',
        resourceId: withdrawalId,
        metadata: {
          amount: transactionAmount,
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
        status: 'rejected',
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
