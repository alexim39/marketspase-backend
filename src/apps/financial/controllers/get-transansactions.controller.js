// admin-financial.controller.js
import { UserModel } from '../../user/models/user.model.js';
import { CampaignModel } from '../../campaign/models/campaign.model.js';
import { PromotionModel } from '../../promotion/models/promotion.model.js';
import mongoose from 'mongoose';
import { transformTransaction } from '../services/transform-transaction.service.js';


export const getTransactions = async (req, res) => {
  try {
    const {
      type,
      category,
      status,
      page = 1,
      limit = 20,
      startDate,
      endDate
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    // Build date filter
    const dateFilter = {};
    if (startDate) {
      dateFilter.$gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.$lte = new Date(endDate);
    }

    const matchQuery = {
      $or: [
        { 'wallets.promoter.transactions': { $exists: true, $ne: [] } },
        { 'wallets.marketer.transactions': { $exists: true, $ne: [] } }
      ]
    };

    if (Object.keys(dateFilter).length > 0) {
      matchQuery['$or'] = [
        { 'wallets.promoter.transactions.createdAt': dateFilter },
        { 'wallets.marketer.transactions.createdAt': dateFilter }
      ];
    }

    const users = await UserModel.aggregate([
      { $match: matchQuery },
      { $unwind: '$wallets.promoter.transactions' },
      { $unwind: '$wallets.marketer.transactions' },
      {
        $project: {
          displayName: 1,
          email: 1,
          role: 1,
          promoterTxn: '$wallets.promoter.transactions',
          marketerTxn: '$wallets.marketer.transactions'
        }
      },
      { $skip: skip },
      { $limit: limitNum }
    ]);

    // Transform transactions
    const transactions = [];
    
    users.forEach(user => {
      if (user.promoterTxn) {
        transactions.push(transformTransaction(user, user.promoterTxn, 'promoter'));
      }
      if (user.marketerTxn) {
        transactions.push(transformTransaction(user, user.marketerTxn, 'marketer'));
      }
    });

    // Apply filters
    let filteredTransactions = transactions;
    
    if (type) {
      filteredTransactions = filteredTransactions.filter(t => t.type === type);
    }
    
    if (category) {
      filteredTransactions = filteredTransactions.filter(t => t.category === category);
    }
    
    if (status) {
      filteredTransactions = filteredTransactions.filter(t => t.status === status);
    }

    // Sort by date
    filteredTransactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Get total count (this would need optimization for large datasets)
    const totalCount = await getTotalTransactionCount(req.query);

    res.json({
      success: true,
      data: {
        transactions: filteredTransactions,
        total: totalCount,
        page: parseInt(page),
        limit: limitNum
      }
    });
  } catch (error) {
    console.error('Error getting transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching transactions'
    });
  }
};