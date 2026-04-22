// file: admin.refund.controller.js
import { UserModel } from '../../user/models/user/index.js';
import mongoose from 'mongoose';

/**
 * Admin Refund Controller for Promoter Balance
 * Handles balance refund operations for promoter users
 */
export class AdminRefundController {
  
  /**
   * Refund a specific amount to a promoter's wallet
   * @param {Object} options - Refund options
   * @param {string} options.promoterUserId - The promoter's user ID or username
   * @param {number} options.amount - Amount to refund
   * @param {string} options.reason - Reason for refund
   * @param {string} options.adminId - Admin performing the refund
   * @param {Object} options.metadata - Additional metadata (optional)
   * @returns {Promise<Object>} Refund result
   */
/**
 * Refund to specific wallet
 */
static async refundToWallet({
  promoterUserId,
  amount,
  reason,
  walletType = 'promoter',
  adminId,
  metadata = {}
}) {
  console.log('Refunding to wallet:', { promoterUserId, amount, walletType, adminId });
  
  // Validate inputs
  if (!promoterUserId || !amount || !reason || !adminId) {
    throw new Error('Missing required parameters: promoterUserId, amount, reason, adminId');
  }

  if (!['promoter', 'marketer'].includes(walletType)) {
    throw new Error('Invalid wallet type. Must be "promoter" or "marketer"');
  }

  if (amount <= 0) {
    throw new Error('Refund amount must be greater than zero');
  }

  const session = await mongoose.startSession();
  let transactionCommitted = false;

  try {
    session.startTransaction();

    // Build query based on the identifier type
    const query = {
      $or: [],
      isActive: true,
      isDeleted: false
    };
    
    if (mongoose.Types.ObjectId.isValid(promoterUserId)) {
      query.$or.push({ _id: new mongoose.Types.ObjectId(promoterUserId) });
    }
    
    query.$or.push(
      { username: promoterUserId },
      { email: promoterUserId },
      { uid: promoterUserId }
    );

    const user = await UserModel.findOne(query).session(session);

    if (!user) {
      throw new Error(`User not found: ${promoterUserId}`);
    }
    
    console.log(`User found: ${user.username}, checking for ${walletType} wallet`);
    console.log('Available wallets:', Object.keys(user.wallets || {}));
    
    if (!user.wallets?.[walletType]) {
      throw new Error(`${walletType} wallet not found for this user. Available: ${Object.keys(user.wallets || {}).join(', ')}`);
    }

    const transaction = {
      _id: new mongoose.Types.ObjectId(),
      amount: amount,
      type: 'credit',
      category: 'refund',
      description: `Admin refund to ${walletType} wallet: ${reason}`,
      status: 'completed',
      metadata: {
        ...metadata,
        refundReason: reason,
        processedByAdmin: adminId,
        processedAt: new Date(),
        walletType: walletType,
        originalUserId: user._id,
        originalUsername: user.username
      },
      createdAt: new Date()
    };

    const previousBalance = user.wallets[walletType].balance || 0;
    user.wallets[walletType].balance = previousBalance + amount;
    
    if (!user.wallets[walletType].transactions) {
      user.wallets[walletType].transactions = [];
    }
    user.wallets[walletType].transactions.unshift(transaction);

    await user.save({ session });

    // Commit transaction
    await session.commitTransaction();
    transactionCommitted = true;

    console.log(`Successfully refunded ${amount} to ${user.username}'s ${walletType} wallet`);

    // Log activities (non-critical)
    try {
      await user.logActivity('refund_received', `Received refund of ${amount} NGN to ${walletType} wallet from admin`, {
        resourceType: 'transaction',
        resourceId: transaction._id,
        metadata: {
          amount,
          reason,
          adminId,
          previousBalance,
          newBalance: user.wallets[walletType].balance,
          walletType
        }
      });
    } catch (logError) {
      console.warn('Failed to log user activity:', logError);
    }

    return {
      success: true,
      message: `Successfully refunded ${amount} NGN to ${user.username}'s ${walletType} wallet`,
      data: {
        transactionId: transaction._id,
        user: {
          id: user._id,
          username: user.username,
          email: user.email
        },
        refundDetails: {
          amount,
          reason,
          walletType,
          processedBy: adminId,
          processedAt: new Date(),
          previousBalance,
          newBalance: user.wallets[walletType].balance
        }
      }
    };

  } catch (error) {
    if (session.transaction.isActive && !transactionCommitted) {
      await session.abortTransaction();
    }
    
    console.error('Refund failed:', error);
    throw new Error(`Refund failed: ${error.message}`);
  } finally {
    await session.endSession();
  }
}

  
  /**
 * Get promoter's current balance and transaction history
 * @param {string} promoterIdentifier - User ID, username, or email
 * @returns {Promise<Object>} Promoter wallet details
 */
static async getPromoterWalletDetails(identifier) {
  try {
    const query = {
      $or: [],
      isActive: true,
      isDeleted: false
    };
    
    if (mongoose.Types.ObjectId.isValid(identifier)) {
      query.$or.push({ _id: new mongoose.Types.ObjectId(identifier) });
    }
    
    query.$or.push(
      { username: identifier },
      { email: identifier },
      { uid: identifier }
    );
    
    const user = await UserModel.findOne(query).select('username email displayName role wallets');
    
    if (!user) {
      throw new Error(`User not found: ${identifier}`);
    }
    
    // Return ALL wallets
    const wallets = {};
    
    if (user.wallets?.promoter) {
      wallets.promoter = {
        balance: user.wallets.promoter.balance || 0,
        reserved: user.wallets.promoter.reserved || 0,
        currency: user.wallets.promoter.currency || 'NGN'
      };
    }
    
    if (user.wallets?.marketer) {
      wallets.marketer = {
        balance: user.wallets.marketer.balance || 0,
        reserved: user.wallets.marketer.reserved || 0,
        currency: user.wallets.marketer.currency || 'NGN'
      };
    }
    
    return {
      success: true,
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          displayName: user.displayName,
          role: user.role
        },
        wallets: wallets // Return ALL wallets
      }
    };
  } catch (error) {
    console.error('Failed to get user wallet details:', error);
    throw new Error(`Failed to get wallet details: ${error.message}`);
  }
}

// Keep the old method for backward compatibility
static async refundPromoterBalance(options) {
  // Default to promoter wallet for backward compatibility
  return this.refundToWallet({
    ...options,
    walletType: options.walletType || 'promoter'
  });
}


  /**
   * Refund multiple promoters in bulk
   * @param {Array} refunds - Array of refund objects
   * @param {string} adminId - Admin performing the bulk refund
   * @returns {Promise<Object>} Bulk refund results
   */
  static async bulkRefundPromoters(refunds, adminId) {
    if (!Array.isArray(refunds) || refunds.length === 0) {
      throw new Error('Refunds array is required and cannot be empty');
    }

    const results = {
      totalProcessed: 0,
      successful: [],
      failed: []
    };

    for (const refund of refunds) {
      try {
        const result = await this.refundPromoterBalance({
          promoterUserId: refund.promoterUserId,
          amount: refund.amount,
          reason: refund.reason || 'Bulk refund',
          adminId,
          metadata: {
            bulkRefundBatch: true,
            ...refund.metadata
          }
        });

        results.successful.push({
          promoterUserId: refund.promoterUserId,
          amount: refund.amount,
          transactionId: result.data.transactionId,
          message: result.message
        });
        results.totalProcessed++;

      } catch (error) {
        results.failed.push({
          promoterUserId: refund.promoterUserId,
          amount: refund.amount,
          error: error.message
        });
      }
    }

    return {
      success: true,
      message: `Processed ${results.totalProcessed} refunds (${results.successful.length} successful, ${results.failed.length} failed)`,
      data: results
    };
  }

  /**
   * Get refund transaction history for a promoter
   * @param {string} promoterIdentifier - User ID, username, or email
   * @param {Object} options - Query options
   * @param {number} options.limit - Number of transactions to return
   * @param {number} options.page - Page number
   * @returns {Promise<Object>} Refund history
   */
  static async getPromoterRefundHistory(promoterIdentifier, options = {}) {
    const limit = options.limit || 20;
    const page = options.page || 1;
    const skip = (page - 1) * limit;

    try {
      const promoter = await UserModel.findOne({
        $or: [
          { _id: promoterIdentifier },
          { uid: promoterIdentifier },
          { username: promoterIdentifier },
          { email: promoterIdentifier }
        ],
        role: 'promoter'
      });

      if (!promoter) {
        throw new Error('Promoter not found');
      }

      const allTransactions = promoter.wallets?.promoter?.transactions || [];
      
      // Filter for refund transactions
      const refundTransactions = allTransactions.filter(
        tx => tx.category === 'refund'
      );

      // Sort by date (newest first)
      const sortedTransactions = refundTransactions.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );

      // Paginate results
      const paginatedTransactions = sortedTransactions.slice(skip, skip + limit);

      return {
        success: true,
        data: {
          promoter: {
            id: promoter._id,
            username: promoter.username,
            email: promoter.email
          },
          refunds: {
            total: refundTransactions.length,
            page,
            limit,
            totalPages: Math.ceil(refundTransactions.length / limit),
            transactions: paginatedTransactions
          }
        }
      };
    } catch (error) {
      console.error('Failed to get refund history:', error);
      throw new Error(`Failed to get refund history: ${error.message}`);
    }
  }


/**
 * Validate if a refund can be processed for a promoter
 * @param {string} promoterIdentifier - Promoter identifier (could be _id, uid, username, or email)
 * @param {number} amount - Amount to refund
 * @returns {Promise<Object>} Validation result
 */
static async validateRefund(promoterIdentifier, amount, walletType = 'promoter') {
  try {
    console.log('Validating refund:', { promoterIdentifier, amount, walletType });
    
    // Build query based on the identifier type
    const query = {
      $or: [],
      isActive: true,
      isDeleted: false
    };
    
    // Check if it's a valid MongoDB ObjectId
    if (mongoose.Types.ObjectId.isValid(promoterIdentifier)) {
      query.$or.push({ _id: new mongoose.Types.ObjectId(promoterIdentifier) });
    }
    
    // Always try username and email
    query.$or.push(
      { username: promoterIdentifier },
      { email: promoterIdentifier },
      { uid: promoterIdentifier }
    );
    
    console.log('Search query:', JSON.stringify(query.$or, null, 2));
    
    const user = await UserModel.findOne(query);

    console.log('Found user:', user ? `Yes: ${user.username} (${user._id})` : 'No');
    
    if (!user) {
      return {
        valid: false,
        error: `User not found. Please check the identifier: ${promoterIdentifier}`
      };
    }

    // Check if specified wallet exists
    if (!user.wallets?.[walletType]) {
      // List available wallets for better error message
      const availableWallets = Object.keys(user.wallets || {}).filter(k => user.wallets[k]);
      
      return {
        valid: false,
        error: `${walletType} wallet not found for this user. Available wallets: ${
          availableWallets.length > 0 ? availableWallets.join(', ') : 'none'
        }`
      };
    }

    // Get current balance
    const currentBalance = user.wallets[walletType].balance || 0;
    
    // For marketer wallet, add warning but still allow refund
    let warning = null;
    if (walletType === 'marketer') {
      warning = 'Note: Marketer wallet funds are locked for in-app use only (cannot be withdrawn)';
    }

    if (amount <= 0) {
      return {
        valid: false,
        error: 'Refund amount must be greater than zero'
      };
    }

    if (amount > 1000000) {
      return {
        valid: false,
        error: 'Refund amount cannot exceed ₦1,000,000'
      };
    }

    // Get the other wallet info if it exists
    const otherWallets = Object.keys(user.wallets || {})
      .filter(w => w !== walletType && user.wallets[w])
      .map(w => ({
        type: w,
        balance: user.wallets[w].balance || 0
      }));
    
    return {
      valid: true,
      warning,
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          displayName: user.displayName
        },
        wallet: {
          type: walletType,
          currentBalance: currentBalance,
          newBalance: currentBalance + amount,
          currency: user.wallets[walletType].currency || 'NGN'
        },
        otherWallets: otherWallets, // Include other wallet info
        validation: {
          amount,
          maximumAllowed: 1000000,
          isValidAmount: amount <= 1000000
        }
      }
    };

  } catch (error) {
    console.error('Refund validation failed:', error);
    return {
      valid: false,
      error: `Validation failed: ${error.message}`
    };
  }
}


/**
 * Search promoters by query
 * @param {string} query - Search query
 * @returns {Promise<Object>} Search results
 */
static async searchPromoters(query) {
  try {
    if (!query || query.length < 2) {
      return {
        success: true,
        data: []
      };
    }

    const promoters = await UserModel.find({
      $or: [
        { username: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
        { displayName: { $regex: query, $options: 'i' } }
      ],
      role: { $in: ['promoter', 'marketer'] },
      isActive: true,
      isDeleted: false
    })
    .limit(10)
    .select('username email displayName role wallets.promoter wallets.marketer isActive isVerified');

    return {
      success: true,
      data: promoters
    };
  } catch (error) {
    console.error('Search promoters error:', error);
    return {
      success: false,
      error: `Search failed: ${error.message}`
    };
  }
}
}

// Export as default
export default AdminRefundController;