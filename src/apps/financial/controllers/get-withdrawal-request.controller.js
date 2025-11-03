import { UserModel } from '../../user/models/user.model.js';

export const getWithdrawalRequests = async (req, res) => {
  try {
    const {
      status = 'all',
      page = 1,
      limit = 10,
      search = ''
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    // Build match query
    const matchQuery = {};
    
    if (status !== 'all') {
      matchQuery['wallets.promoter.transactions.status'] = status;
    }

    if (search) {
      matchQuery['$or'] = [
        { displayName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { 'savedAccounts.accountNumber': { $regex: search, $options: 'i' } },
        { 'savedAccounts.bankName': { $regex: search, $options: 'i' } }
      ];
    }

    // First, get total count
    const totalUsers = await UserModel.countDocuments(matchQuery);

    // Get users with withdrawal transactions
    const users = await UserModel.aggregate([
      { $match: matchQuery },
      { $unwind: { path: '$wallets.promoter.transactions', preserveNullAndEmptyArrays: true } },
      {
        $match: {
          $or: [
            { 'wallets.promoter.transactions.category': 'withdrawal' },
          ]
        }
      },
      { $skip: skip },
      { $limit: limitNum },
      {
        $project: {
          _id: 1,
          displayName: 1,
          email: 1,
          role: 1,
          promoterTransactions: '$wallets.promoter.transactions',
          savedAccounts: 1,
          createdAt: 1
        }
      }
    ]);

    // Transform data into withdrawal requests format
    const withdrawalRequests = [];
    
    users.forEach(user => {
      // Process promoter wallet withdrawals
      if (user.promoterTransactions && user.promoterTransactions.category === 'withdrawal') {
        const transaction = user.promoterTransactions;
        const bankAccount = user.savedAccounts?.find(acc => acc.isDefault) || user.savedAccounts?.[0];
        
        if (bankAccount) {
          withdrawalRequests.push({
            id: transaction._id?.toString() || `WD-${Date.now()}`,
            userId: user._id.toString(),
            userName: user.displayName,
            userEmail: user.email,
            userRole: 'promoter',
            amount: transaction.amount,
            bankName: bankAccount.bank,
            bankCode: bankAccount.bankCode,
            accountNumber: bankAccount.accountNumber,
            accountName: bankAccount.accountName,
            status: transaction.status,
            createdAt: transaction.createdAt,
            processedAt: transaction.processedAt,
            walletType: 'promoter',
            reference: transaction.reference
          });
        }
      }

    });

    // Sort by creation date, most recent first
    withdrawalRequests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      success: true,
      data: {
        requests: withdrawalRequests,
        total: totalUsers,
        page: parseInt(page),
        limit: limitNum
      }
    });
  } catch (error) {
    console.error('Error getting withdrawal requests:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching withdrawal requests'
    });
  }
};