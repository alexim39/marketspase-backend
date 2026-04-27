// controllers/get-transfers.controller.js
import { UserModel } from '../../../user/models/user/index.js';
import { TransactionModel } from '../../../user/models/transaction/index.js';

export const getTransferTransactions = async (req, res) => {
  try {
    const {
      transferType = 'all',      // 'all', 'self', 'other'
      destinationType = 'all',   // 'all', 'marketer', 'promoter'
      page = 1,
      limit = 50,
      search = '',
      fromDate,
      toDate
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    // Build query for TransactionModel
    const query = { category: 'transfer' };
    
    if (transferType !== 'all') {
      query['meta.transferType'] = transferType;
    }
    
    if (destinationType !== 'all') {
      query['meta.destinationType'] = destinationType;
    }

    // Date range filter
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate) query.createdAt.$lte = new Date(toDate);
    }

    // Get total count
    const total = await TransactionModel.countDocuments(query);

    // Get transactions with pagination
    const transactions = await TransactionModel.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Enrich with user details
    const enrichedTransfers = await Promise.all(
      transactions.map(async (tx) => {
        const sourceUser = await UserModel.findById(tx.meta?.sourceUserId)
          .select('displayName email role username')
          .lean();
        
        const destinationUser = await UserModel.findById(tx.meta?.destinationUserId)
          .select('displayName email role username')
          .lean();

        return {
          transferId: tx._id.toString(),
          reference: tx.reference,
          transferType: tx.meta?.transferType || 'other',
          amount: tx.amount,
          
          sourceUserId: tx.meta?.sourceUserId,
          sourceUserName: sourceUser?.displayName || 'Unknown',
          sourceUserEmail: sourceUser?.email || '',
          sourceUserRole: sourceUser?.role || '',
          sourceUsername: sourceUser?.username || '',
          
          destinationUserId: tx.meta?.destinationUserId,
          destinationUserName: destinationUser?.displayName || 'Unknown',
          destinationUserEmail: destinationUser?.email || '',
          destinationUserRole: destinationUser?.role || '',
          destinationUsername: destinationUser?.username || '',
          
          destinationWalletType: tx.meta?.destinationType || 'promoter',
          marketerLocked: tx.meta?.marketerLocked || false,
          lockedReason: tx.meta?.lockedReason || null,
          
          status: tx.status,
          note: tx.meta?.note,
          createdAt: tx.createdAt,
          processedAt: tx.processedAt
        };
      })
    );

    // Apply search filter if provided (after enrichment)
    let filteredTransfers = enrichedTransfers;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredTransfers = enrichedTransfers.filter(t => 
        t.sourceUserName?.toLowerCase().includes(searchLower) ||
        t.sourceUserEmail?.toLowerCase().includes(searchLower) ||
        t.destinationUserName?.toLowerCase().includes(searchLower) ||
        t.destinationUserEmail?.toLowerCase().includes(searchLower) ||
        t.reference?.toLowerCase().includes(searchLower)
      );
    }

    res.json({
      success: true,
      data: {
        transfers: filteredTransfers,
        total: search ? filteredTransfers.length : total,
        page: parseInt(page),
        limit: limitNum
      }
    });

  } catch (error) {
    console.error('Error getting transfer transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching transfer transactions'
    });
  }
};

export const getTransferStats = async (req, res) => {
  try {
    const pipeline = [
      { $match: { category: 'transfer' } },
      {
        $group: {
          _id: null,
          totalTransfers: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          selfTransfers: {
            $sum: { $cond: [{ $eq: ['$meta.transferType', 'self'] }, 1, 0] }
          },
          otherTransfers: {
            $sum: { $cond: [{ $eq: ['$meta.transferType', 'other'] }, 1, 0] }
          },
          toMarketerWallet: {
            $sum: { $cond: [{ $eq: ['$meta.destinationType', 'marketer'] }, 1, 0] }
          },
          toPromoterWallet: {
            $sum: { $cond: [{ $eq: ['$meta.destinationType', 'promoter'] }, 1, 0] }
          },
          lockedAmount: {
            $sum: {
              $cond: [{ $eq: ['$meta.marketerLocked', true] }, '$amount', 0]
            }
          }
        }
      }
    ];

    const result = await TransactionModel.aggregate(pipeline);
    const stats = result[0] || {
      totalTransfers: 0,
      totalAmount: 0,
      selfTransfers: 0,
      otherTransfers: 0,
      toMarketerWallet: 0,
      toPromoterWallet: 0,
      lockedAmount: 0
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error getting transfer stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching transfer statistics'
    });
  }
};

export const getTransferById = async (req, res) => {
  try {
    const { transferId } = req.params;

    const transaction = await TransactionModel.findById(transferId);
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transfer not found'
      });
    }

    const sourceUser = await UserModel.findById(transaction.meta?.sourceUserId)
      .select('displayName email role username')
      .lean();
    
    const destinationUser = await UserModel.findById(transaction.meta?.destinationUserId)
      .select('displayName email role username')
      .lean();

    const transfer = {
      transferId: transaction._id.toString(),
      reference: transaction.reference,
      transferType: transaction.meta?.transferType || 'other',
      amount: transaction.amount,
      
      sourceUserId: transaction.meta?.sourceUserId,
      sourceUserName: sourceUser?.displayName || 'Unknown',
      sourceUserEmail: sourceUser?.email || '',
      sourceUserRole: sourceUser?.role || '',
      
      destinationUserId: transaction.meta?.destinationUserId,
      destinationUserName: destinationUser?.displayName || 'Unknown',
      destinationUserEmail: destinationUser?.email || '',
      destinationUserRole: destinationUser?.role || '',
      
      destinationWalletType: transaction.meta?.destinationType || 'promoter',
      marketerLocked: transaction.meta?.marketerLocked || false,
      lockedReason: transaction.meta?.lockedReason || null,
      
      status: transaction.status,
      note: transaction.meta?.note,
      createdAt: transaction.createdAt,
      processedAt: transaction.processedAt,
      meta: transaction.meta
    };

    res.json({
      success: true,
      data: transfer
    });

  } catch (error) {
    console.error('Error getting transfer by ID:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching transfer details'
    });
  }
};