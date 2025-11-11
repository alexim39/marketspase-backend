import { UserModel } from '../../user/models/user.model.js';

export const approveWithdrawal = async (req, res) => {
  try {
    const { withdrawalId } = req.params;
    const { notes } = req.body;
    const adminUser = req.user?.displayName || 'System Admin';

    //console.log(`Approving withdrawal ID: ${withdrawalId} by admin: ${adminUser}`);

    // Find user with this withdrawal transaction (promoter only)
    const user = await UserModel.findOne({
      'wallets.promoter.transactions._id': withdrawalId
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal request not found'
      });
    }

    // Find the transaction in promoter wallet
    let transactionIndex = -1;
    let transaction = null;

    if (user.wallets.promoter.transactions) {
      transactionIndex = user.wallets.promoter.transactions.findIndex(
        t => t._id.toString() === withdrawalId
      );
      
      if (transactionIndex !== -1) {
        transaction = user.wallets.promoter.transactions[transactionIndex];
      }
    }

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal transaction not found'
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
    if (transaction.status === 'approved' || transaction.status === 'successful') {
      return res.status(400).json({
        success: false,
        message: 'This withdrawal has already been approved'
      });
    }

    // VALIDATION: Ensure withdrawal is in pending status
    if (transaction.status !== 'processing') {
    // if (transaction.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot approve withdrawal with status: ${transaction.status}`
      });
    }

    // CRITICAL: Validate promoter has sufficient AVAILABLE balance (not reserved)
    const transactionAmount = transaction.amount;
    const availableBalance = user.wallets.promoter.balance;

    if (availableBalance < transactionAmount) {
      return res.status(400).json({
        success: false,
        message: `Insufficient available balance. Available: ₦${availableBalance}, Requested: ₦${transactionAmount}`
      });
    }

    // VALIDATION: Check bank details exist for the withdrawal
    if (!transaction.bankDetails || !transaction.bankDetails.accountNumber) {
      return res.status(400).json({
        success: false,
        message: 'Bank details are missing for this withdrawal'
      });
    }

    // PROCESS THE WITHDRAWAL
    // 1. Update transaction status
    user.wallets.promoter.transactions[transactionIndex].status = 'approved';
    user.wallets.promoter.transactions[transactionIndex].processedAt = new Date();
    
    // 2. Deduct from promoter's AVAILABLE balance (this is earned money they're withdrawing)
    const previousBalance = user.wallets.promoter.balance;
    //user.wallets.promoter.balance -= transactionAmount; // duplicate deduction as funds have duducted at request time

    await user.save();

    // Log activity
    await user.logActivity('withdrawal_approved', `Withdrawal of ₦${transactionAmount} to ${transaction.bankDetails.bank} approved by admin`, {
      resourceType: 'transaction',
      resourceId: withdrawalId,
      metadata: {
        amount: transactionAmount,
        previousBalance: previousBalance,
        newBalance: user.wallets.promoter.balance,
        bank: transaction.bankDetails.bank,
        accountNumber: transaction.bankDetails.accountNumber,
        accountName: transaction.bankDetails.accountName,
        approvedBy: adminUser,
        notes
      }
    });

    res.json({
      success: true,
      message: 'Withdrawal approved successfully',
      data: {
        id: withdrawalId,
        amount: transactionAmount,
        status: 'approved',
        previousBalance: previousBalance,
        newBalance: user.wallets.promoter.balance,
        bankDetails: {
          bank: transaction.bankDetails.bank,
          accountName: transaction.bankDetails.accountName,
          accountNumber: transaction.bankDetails.accountNumber
        },
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