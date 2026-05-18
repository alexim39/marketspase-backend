import { UserModel } from '../../../user/models/user/index.js';
import mongoose from 'mongoose';

/**
 * Get transaction summary with period filtering
 * Provides aggregated data for transaction overview, metrics, and recent transactions
 */
export const getTransactionSummary = async (req, res) => {
  try {
    const { role, period = 'all' } = req.query;
    const userId = req.userId;

    // Validate required parameters
    if (!userId || !role) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: userId and role',
        code: 'MISSING_PARAMETERS'
      });
    }

    // Validate role
    if (!['promoter', 'marketer'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be "promoter" or "marketer"',
        code: 'INVALID_ROLE'
      });
    }

    // Find user
    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Get the appropriate wallet based on role
    const wallet = user.wallets?.[role];
    if (!wallet) {
      return res.status(200).json({
        success: true,
        data: createEmptySummary(period, role)
      });
    }

    const transactions = wallet.transactions || [];
    
    // Calculate date range based on period
    const dateRange = getDateRangeForPeriod(period);
    
    // Filter transactions by date range
    const filteredTransactions = transactions.filter(tx => {
      const txDate = new Date(tx.createdAt);
      return txDate >= dateRange.startDate && txDate <= dateRange.endDate;
    });

    // Calculate overview metrics
    const overview = calculateOverviewMetrics(filteredTransactions, wallet, role);
    
    // Calculate additional metrics
    const metrics = calculateTransactionMetrics(filteredTransactions);
    
    // Get recent transactions (last 5 within the period)
    const recentTransactions = filteredTransactions
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5)
      .map(tx => ({
        _id: tx._id,
        reference: tx.reference,
        description: tx.description,
        amount: tx.amount,
        type: tx.type,
        category: tx.category,
        status: tx.status,
        createdAt: tx.createdAt,
        amountPayable: tx.amountPayable,
        meta: {
          bankDetails: tx.bankDetails ? {
            bank: tx.bankDetails.bank,
            accountNumber: tx.bankDetails.accountNumber?.slice(-4)
          } : undefined
        }
      }));

    const summaryData = {
      period: {
        type: period,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      },
      overview,
      metrics,
      recentTransactions
    };

    return res.status(200).json({
      success: true,
      data: summaryData
    });

  } catch (error) {
    console.error('Error fetching transaction summary:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch transaction summary',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
};

/**
 * Calculate date range based on period parameter
 */
function getDateRangeForPeriod(period) {
  const now = new Date();
  const endDate = new Date(now);
  endDate.setHours(23, 59, 59, 999);
  
  let startDate = new Date(0); // Beginning of time for 'all'
  
  switch (period) {
    case 'today':
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
      break;
      
    case 'week':
      startDate = new Date(now);
      startDate.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
      startDate.setHours(0, 0, 0, 0);
      break;
      
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      startDate.setHours(0, 0, 0, 0);
      break;
      
    case 'all':
    default:
      startDate = new Date(0);
      break;
  }
  
  return { startDate, endDate };
}

/**
 * Calculate overview metrics based on role
 */
function calculateOverviewMetrics(transactions, wallet, role) {
  const overview = {
    totalEarnings: 0,
    totalWithdrawn: 0,
    pendingWithdrawals: 0,
    availableBalance: wallet.balance || 0,
    serviceFeesPaid: 0,
    totalDeposits: 0,
    totalSpent: 0,
    activeCampaignBudget: wallet.reserved || 0
  };

  for (const tx of transactions) {
    const amount = tx.amount || 0;
    const fee = tx.fee || 0;
    const status = tx.status || 'pending';
    const category = tx.category || 'other';
    const type = tx.type || 'debit';

    const isSuccessfulCredit = status === 'successful' || status === 'completed';

    if (role === 'promoter') {
      // Calculate promoter-specific metrics
      if (type === 'credit' && isSuccessfulCredit) {
        if (category === 'promotion' || category === 'bonus') {
          overview.totalEarnings += amount;
        }
      }
      
      if (type === 'debit' && category === 'withdrawal') {
        if (status === 'successful' || status === 'completed') {
          overview.totalWithdrawn += amount;
        } else if (status === 'pending' || status === 'processing') {
          overview.pendingWithdrawals += amount;
        }
        overview.serviceFeesPaid += fee;
      }
    } else {
      // Calculate marketer-specific metrics
      if (type === 'credit' && category === 'deposit' && status === 'successful') {
        overview.totalDeposits += amount;
      }
      
      if (type === 'debit' && status === 'successful') {
        if (category === 'campaign' || category === 'promotion') {
          overview.totalSpent += amount;
        }
      }
    }
  }

  return overview;
}

/**
 * Calculate transaction metrics
 */
function calculateTransactionMetrics(transactions) {
  const successfulTxs = transactions.filter(tx => 
    tx.status === 'successful' || tx.status === 'completed'
  );
  
  const amounts = successfulTxs.map(tx => tx.amount).filter(amount => amount > 0);
  
  const totalCount = transactions.length;
  const successfulCount = successfulTxs.length;
  
  const averageTransactionValue = amounts.length > 0 ? amounts.reduce((sum, val) => sum + val, 0) / amounts.length : 0;
  
  const largestTransaction = amounts.length > 0 ? Math.max(...amounts) : 0;
  
  const successRate = totalCount > 0 ? Math.round((successfulCount / totalCount) * 100) : 0;

  return {
    transactionCount: totalCount,
    averageTransactionValue: Math.round(averageTransactionValue * 100) / 100,
    largestTransaction,
    successRate
  };
}

/**
 * Create empty summary for users with no transactions
 */
function createEmptySummary(period, role) {
  return {
    period: {
      type: period,
      startDate: getDateRangeForPeriod(period).startDate,
      endDate: getDateRangeForPeriod(period).endDate
    },
    overview: {
      totalEarnings: 0,
      totalWithdrawn: 0,
      pendingWithdrawals: 0,
      availableBalance: 0,
      serviceFeesPaid: 0,
      totalDeposits: 0,
      totalSpent: 0,
      activeCampaignBudget: 0
    },
    metrics: {
      transactionCount: 0,
      averageTransactionValue: 0,
      largestTransaction: 0,
      successRate: 0
    },
    recentTransactions: []
  };
}
