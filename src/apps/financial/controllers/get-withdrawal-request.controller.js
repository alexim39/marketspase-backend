import { UserModel } from '../../user/models/user/index.js';

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

    // 🔍 Match only promoter users (since only promoters can withdraw)
    const matchConditions = [{ role: 'promoter' }];

    if (search) {
      matchConditions.push({
        $or: [
          { displayName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { 'wallets.promoter.transactions.bankDetails.bank': { $regex: search, $options: 'i' } },
          { 'wallets.promoter.transactions.bankDetails.accountNumber': { $regex: search, $options: 'i' } },
          { 'wallets.promoter.transactions.bankDetails.accountName': { $regex: search, $options: 'i' } }
        ]
      });
    }

    const pipeline = [
      { $match: { $and: matchConditions } },
      { $unwind: '$wallets.promoter.transactions' },
      {
        $match: {
          'wallets.promoter.transactions.category': 'withdrawal',
          'wallets.promoter.transactions.type': 'debit'
        }
      }
    ];

    if (status !== 'all') {
      pipeline.push({
        $match: { 'wallets.promoter.transactions.status': status }
      });
    }

    // Count total before pagination
    const totalCount = await UserModel.aggregate([
      ...pipeline,
      { $count: 'total' }
    ]);
    const total = totalCount[0]?.total || 0;

    // 🔽 Add sorting, pagination, and projection
    pipeline.push(
      { $sort: { 'wallets.promoter.transactions.createdAt': -1 } },
      { $skip: skip },
      { $limit: limitNum },
      {
        $project: {
          _id: 1,
          displayName: 1,
          email: 1,
          transaction: '$wallets.promoter.transactions',
          withdrawalId: '$wallets.promoter.transactions._id'
        }
      }
    );

    const results = await UserModel.aggregate(pipeline);

    // 🧾 Format clean response
    const withdrawalRequests = results.map(user => {
      const t = user.transaction;
      const bank = t.bankDetails || {};
      return {
        withdrawalId: t._id?.toString(),  // ✅ now explicitly included
        userId: user._id.toString(),
        userName: user.displayName,
        userEmail: user.email,
        userRole: 'promoter',
        amount: t.amount,
        amountPayable: t.amountPayable || 0,
        fee: t.fee || 0,
        bankName: bank.bank || 'N/A',
        bankCode: bank.bankCode || '',
        accountNumber: bank.accountNumber || '',
        accountName: bank.accountName || '',
        status: t.status,
        createdAt: t.createdAt,
        processedAt: t.processedAt || null,
        walletType: 'promoter',
        reference: t.reference || '',
        failureReason: t.failureReason || null
      };
    });

    res.json({
      success: true,
      data: {
        requests: withdrawalRequests,
        total,
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
