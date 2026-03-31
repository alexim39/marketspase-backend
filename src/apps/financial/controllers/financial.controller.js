// admin-financial.controller.js
import { UserModel } from '../../user/models/user/index.js';
import mongoose from 'mongoose';
import { transformTransaction } from '../services/transform-transaction.service.js';


export const getFinancialOverview = async (req, res) => {
  return null
  try {
    const [stats, recentTransactions, pendingWithdrawals] = await Promise.all([
      calculateFinancialStats(),
      getRecentTransactions(10),
      getPendingWithdrawals(5)
    ]);

    res.json({
      success: true,
      data: {
        stats,
        recentTransactions,
        pendingWithdrawals
      }
    });
  } catch (error) {
    console.error('Error getting financial overview:', error);
    res.status(500).json({
      success: false,
      message: 'Error loading financial overview'
    });
  }
};

export const getFinancialStats = async (req, res) => {
  try {
    const stats = await calculateFinancialStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting financial stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error calculating financial statistics'
    });
  }
};


// Helper functions
async function calculateFinancialStats() {
  const users = await UserModel.find({});
  
  let totalRevenue = 0;
  let platformEarnings = 0;
  let totalWithdrawals = 0;
  let pendingWithdrawals = 0;
  let marketerSpend = 0;
  let promoterEarnings = 0;
  let activeBalance = 0;
  let reservedBalance = 0;
  let totalTransactions = 0;
  let successfulTransactions = 0;

  users.forEach(user => {
    // Calculate platform revenue from fees
    if (user.wallets?.marketer?.transactions) {
      user.wallets.marketer.transactions.forEach(transaction => {
        totalTransactions++;
        if (transaction.status === 'successful') {
          successfulTransactions++;
        }
        
        if (transaction.category === 'fee' && transaction.status === 'successful') {
          totalRevenue += transaction.amount;
          platformEarnings += transaction.amount;
        }
        
        if (transaction.category === 'campaign' && transaction.type === 'debit') {
          marketerSpend += transaction.amount;
        }
      });
    }

    // Calculate promoter earnings and withdrawals
    if (user.wallets?.promoter?.transactions) {
      user.wallets.promoter.transactions.forEach(transaction => {
        totalTransactions++;
        if (transaction.status === 'successful') {
          successfulTransactions++;
        }
        
        if (transaction.category === 'promotion' && transaction.type === 'credit') {
          promoterEarnings += transaction.amount;
        }
        
        if (transaction.category === 'withdrawal') {
          if (transaction.status === 'successful' || transaction.status === 'approved') {
            totalWithdrawals += transaction.amount;
          } else if (transaction.status === 'pending') {
            pendingWithdrawals += transaction.amount;
          }
        }
      });
    }

    // Calculate current balances
    if (user.wallets?.marketer) {
      activeBalance += user.wallets.marketer.balance || 0;
      reservedBalance += user.wallets.marketer.reserved || 0;
    }
    
    if (user.wallets?.promoter) {
      activeBalance += user.wallets.promoter.balance || 0;
      reservedBalance += user.wallets.promoter.reserved || 0;
    }
  });

  return {
    totalRevenue,
    platformEarnings,
    totalWithdrawals,
    pendingWithdrawals,
    marketerSpend,
    promoterEarnings,
    activeBalance,
    reservedBalance,
    totalTransactions,
    successfulTransactions
  };
}

async function getRecentTransactions(limit = 10) {
  const users = await UserModel.aggregate([
    { $unwind: { path: '$wallets.promoter.transactions', preserveNullAndEmptyArrays: true } },
    { $unwind: { path: '$wallets.marketer.transactions', preserveNullAndEmptyArrays: true } },
    { $sort: { 'wallets.promoter.transactions.createdAt': -1, 'wallets.marketer.transactions.createdAt': -1 } },
    { $limit: limit * 2 }, // Get extra to account for both wallets
    {
      $project: {
        displayName: 1,
        email: 1,
        role: 1,
        promoterTxn: '$wallets.promoter.transactions',
        marketerTxn: '$wallets.marketer.transactions'
      }
    }
  ]);

  const transactions = [];
  
  users.forEach(user => {
    if (user.promoterTxn) {
      transactions.push(transformTransaction(user, user.promoterTxn, 'promoter'));
    }
    if (user.marketerTxn) {
      transactions.push(transformTransaction(user, user.marketerTxn, 'marketer'));
    }
  });

  return transactions
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
}

async function getPendingWithdrawals(limit = 5) {
  const users = await UserModel.aggregate([
    {
      $match: {
        $or: [
          { 'wallets.promoter.transactions.status': 'pending' },
          { 'wallets.marketer.transactions.status': 'pending' }
        ]
      }
    },
    { $unwind: '$wallets.promoter.transactions' },
    { $unwind: '$wallets.marketer.transactions' },
    {
      $match: {
        $or: [
          { 'wallets.promoter.transactions.category': 'withdrawal', 'wallets.promoter.transactions.status': 'pending' },
          { 'wallets.marketer.transactions.category': 'withdrawal', 'wallets.marketer.transactions.status': 'pending' }
        ]
      }
    },
    { $limit: limit },
    {
      $project: {
        displayName: 1,
        email: 1,
        role: 1,
        savedAccounts: 1,
        promoterTxn: '$wallets.promoter.transactions',
        marketerTxn: '$wallets.marketer.transactions'
      }
    }
  ]);

  const withdrawals = [];
  
  users.forEach(user => {
    const bankAccount = user.savedAccounts?.find(acc => acc.isDefault) || user.savedAccounts?.[0];
    
    if (user.promoterTxn && user.promoterTxn.category === 'withdrawal' && user.promoterTxn.status === 'pending') {
      withdrawals.push({
        id: user.promoterTxn._id?.toString(),
        userId: user._id.toString(),
        userName: user.displayName,
        userEmail: user.email,
        userRole: 'promoter',
        amount: user.promoterTxn.amount,
        bankName: bankAccount?.bank,
        accountNumber: bankAccount?.accountNumber,
        accountName: bankAccount?.accountName,
        status: 'pending',
        createdAt: user.promoterTxn.createdAt,
        walletType: 'promoter'
      });
    }

    if (user.marketerTxn && user.marketerTxn.category === 'withdrawal' && user.marketerTxn.status === 'pending') {
      withdrawals.push({
        id: user.marketerTxn._id?.toString(),
        userId: user._id.toString(),
        userName: user.displayName,
        userEmail: user.email,
        userRole: 'marketer',
        amount: user.marketerTxn.amount,
        bankName: bankAccount?.bank,
        accountNumber: bankAccount?.accountNumber,
        accountName: bankAccount?.accountName,
        status: 'pending',
        createdAt: user.marketerTxn.createdAt,
        walletType: 'marketer'
      });
    }
  });

  return withdrawals.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}


async function getTotalTransactionCount(filters) {
  // This is a simplified implementation
  // In production, you'd want to optimize this with proper aggregation
  const users = await UserModel.countDocuments({
    $or: [
      { 'wallets.promoter.transactions': { $exists: true, $ne: [] } },
      { 'wallets.marketer.transactions': { $exists: true, $ne: [] } }
    ]
  });
  
  return users * 2; // Approximate count
}

// Export endpoints
export const exportTransactions = async (req, res) => {
  try {
    const { format, startDate, endDate, type } = req.body;
    
    // Implementation for exporting transactions
    // This would generate CSV/Excel/PDF files
    // For now, return a mock URL
    
    const exportUrl = `/exports/transactions_${Date.now()}.${format}`;
    
    res.json({
      success: true,
      data: {
        url: exportUrl,
        message: `Export generated successfully in ${format.toUpperCase()} format`
      }
    });
  } catch (error) {
    console.error('Error exporting transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting transactions'
    });
  }
};

export const exportWithdrawals = async (req, res) => {
  try {
    const { format, status, startDate, endDate } = req.body;
    
    // Implementation for exporting withdrawals
    const exportUrl = `/exports/withdrawals_${Date.now()}.${format}`;
    
    res.json({
      success: true,
      data: {
        url: exportUrl,
        message: `Withdrawals export generated successfully in ${format.toUpperCase()} format`
      }
    });
  } catch (error) {
    console.error('Error exporting withdrawals:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting withdrawals'
    });
  }
};