// get-withdrawal-request.controller.js
import { UserModel } from '../../user/models/user/index.js';

export const getWithdrawalRequests = async (req, res) => {
  try {
    const {
      status = 'all',
      page = 1,
      limit = 10,
      search = '',
      userRole = 'all' // New filter: 'all', 'promoter', 'marketer'
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    // Build match conditions for user query
    const userMatchConditions = [];
    
    // Filter by role if specified
    if (userRole !== 'all') {
      userMatchConditions.push({ role: userRole });
    }

    if (search) {
      userMatchConditions.push({
        $or: [
          { displayName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { 'wallets.promoter.transactions.bankDetails.bank': { $regex: search, $options: 'i' } },
          { 'wallets.promoter.transactions.bankDetails.accountNumber': { $regex: search, $options: 'i' } },
          { 'wallets.promoter.transactions.bankDetails.accountName': { $regex: search, $options: 'i' } },
          { 'wallets.marketer.transactions.bankDetails.bank': { $regex: search, $options: 'i' } },
          { 'wallets.marketer.transactions.bankDetails.accountNumber': { $regex: search, $options: 'i' } },
          { 'wallets.marketer.transactions.bankDetails.accountName': { $regex: search, $options: 'i' } }
        ]
      });
    }

    // We need to query BOTH promoter and marketer wallets for withdrawals
    const promoterPipeline = buildWithdrawalPipeline('promoter', userMatchConditions, status);
    const marketerPipeline = buildWithdrawalPipeline('marketer', userMatchConditions, status);

    // Execute both pipelines in parallel
    const [promoterResults, marketerResults] = await Promise.all([
      UserModel.aggregate(promoterPipeline),
      UserModel.aggregate(marketerPipeline)
    ]);

    // Combine and format results
    const allWithdrawals = [
      ...promoterResults.map(r => formatWithdrawalRequest(r, 'promoter')),
      ...marketerResults.map(r => formatWithdrawalRequest(r, 'marketer'))
    ];

    // Sort by createdAt descending
    allWithdrawals.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Apply pagination
    const total = allWithdrawals.length;
    const paginatedRequests = allWithdrawals.slice(skip, skip + limitNum);

    res.json({
      success: true,
      data: {
        requests: paginatedRequests,
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

/**
 * Build aggregation pipeline for a specific wallet type
 */
function buildWithdrawalPipeline(walletType, userMatchConditions, status) {
  const pipeline = [
    { $match: userMatchConditions.length > 0 ? { $and: userMatchConditions } : {} },
    { $unwind: `$wallets.${walletType}.transactions` },
    {
      $match: {
        [`wallets.${walletType}.transactions.category`]: 'withdrawal',
        [`wallets.${walletType}.transactions.type`]: 'debit'
      }
    }
  ];

  // Add status filter if specified
  if (status !== 'all') {
    pipeline.push({
      $match: { [`wallets.${walletType}.transactions.status`]: status }
    });
  }

  // Add projection to include wallet type and user info
  pipeline.push({
    $project: {
      _id: 1,
      displayName: 1,
      email: 1,
      role: 1,
      transaction: `$wallets.${walletType}.transactions`,
      withdrawalId: `$wallets.${walletType}.transactions._id`,
      walletType: { $literal: walletType }
    }
  });

  return pipeline;
}

/**
 * Format withdrawal request with additional validation for marketer wallet withdrawals
 */
function formatWithdrawalRequest(result, walletType) {
  const t = result.transaction;
  const bank = t.bankDetails || {};
  
  // Check if this withdrawal is valid based on locked funds
  let isValidWithdrawal = true;
  let invalidityReason = null;

  if (walletType === 'marketer') {
    // Marketer wallet withdrawals are NOT allowed - all funds are locked
    isValidWithdrawal = false;
    invalidityReason = 'Marketer wallet funds cannot be withdrawn - in-app use only';
  } else if (walletType === 'promoter') {
    // For promoter wallet, check if this withdrawal includes locked funds
    // This would require checking the transaction's meta for marketerLocked flag
    if (t.meta?.marketerLocked === true) {
      isValidWithdrawal = false;
      invalidityReason = 'Cannot withdraw funds transferred from marketer wallet';
    }
  }

  return {
    withdrawalId: t._id?.toString(),
    userId: result._id.toString(),
    userName: result.displayName,
    userEmail: result.email,
    userRole: result.role,
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
    walletType: walletType,
    reference: t.reference || '',
    providerReference: t.providerReference,
    transferCode: t.transferCode,
    failureReason: t.failureReason || invalidityReason,
    isValidWithdrawal, // Flag to indicate if this withdrawal should be allowed
    meta: {
      ...t.meta,
      isMarketerLocked: t.meta?.marketerLocked || walletType === 'marketer'
    }
  };
}