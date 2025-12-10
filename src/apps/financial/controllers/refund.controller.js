// file: admin.refund.controller.js
import { UserModel } from '../../user/models/user.model.js';
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
static async refundPromoterBalance({
  promoterUserId,
  amount,
  reason,
  adminId,
  metadata = {}
}) {
  // Validate inputs
  if (!promoterUserId || !amount || !reason || !adminId) {
    throw new Error('Missing required parameters: promoterUserId, amount, reason, adminId');
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
      role: { $in: ['promoter', 'marketer'] },
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

    const promoter = await UserModel.findOne(query).session(session);

    if (!promoter) {
      throw new Error(`Promoter not found: ${promoterUserId}`);
    }

    const walletType = promoter.role === 'promoter' ? 'promoter' : 'marketer';
    
    if (!promoter.wallets?.[walletType]) {
      throw new Error(`${promoter.role} wallet not found`);
    }

    const transaction = {
      _id: new mongoose.Types.ObjectId(),
      amount: amount,
      type: 'credit',
      category: 'refund',
      description: `Admin refund: ${reason}`,
      status: 'completed',
      metadata: {
        ...metadata,
        refundReason: reason,
        processedByAdmin: adminId,
        processedAt: new Date(),
        originalPromoterId: promoter._id,
        originalPromoterUsername: promoter.username
      },
      createdAt: new Date()
    };

    const previousBalance = promoter.wallets[walletType].balance || 0;
    promoter.wallets[walletType].balance = previousBalance + amount;
    
    if (!promoter.wallets[walletType].transactions) {
      promoter.wallets[walletType].transactions = [];
    }
    promoter.wallets[walletType].transactions.unshift(transaction);

    await promoter.save({ session });

    // Commit transaction FIRST before logging activities
    await session.commitTransaction();
    transactionCommitted = true;

    // Now log activities (outside transaction since they're not critical)
    try {
      await promoter.logActivity('refund_received', `Received refund of ${amount} NGN from admin`, {
        resourceType: 'transaction',
        resourceId: transaction._id,
        metadata: {
          amount,
          reason,
          adminId,
          previousBalance,
          newBalance: promoter.wallets[walletType].balance,
          walletType
        }
      });
    } catch (logError) {
      console.warn('Failed to log promoter activity:', logError);
    }

    try {
      const admin = await UserModel.findById(adminId);
      if (admin) {
        await admin.logActivity('admin_refund_issued', `Issued refund of ${amount} NGN to ${promoter.role} ${promoter.username}`, {
          resourceType: 'user',
          resourceId: promoter._id,
          metadata: {
            promoterId: promoter._id,
            promoterUsername: promoter.username,
            promoterRole: promoter.role,
            amount,
            reason,
            transactionId: transaction._id,
            walletType
          }
        });
      }
    } catch (logError) {
      console.warn('Failed to log admin activity:', logError);
    }

    return {
      success: true,
      message: `Successfully refunded ${amount} NGN to ${promoter.role} ${promoter.username}`,
      data: {
        transactionId: transaction._id,
        promoter: {
          id: promoter._id,
          username: promoter.username,
          email: promoter.email,
          role: promoter.role,
          previousBalance,
          newBalance: promoter.wallets[walletType].balance
        },
        refundDetails: {
          amount,
          reason,
          processedBy: adminId,
          processedAt: new Date(),
          walletType
        }
      }
    };

  } catch (error) {
    // Only abort if transaction hasn't been committed
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
static async getPromoterWalletDetails(promoterIdentifier) {
  try {
    // Build query based on the identifier type
    const query = {
      $or: [],
      role: { $in: ['promoter', 'marketer'] },
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
    
    const promoter = await UserModel.findOne(query).select('username email role wallets.promoter wallets.marketer');

    if (!promoter) {
      throw new Error(`Promoter not found: ${promoterIdentifier}`);
    }

    // Determine wallet type based on role
    const walletType = promoter.role === 'promoter' ? 'promoter' : 'marketer';
    const wallet = promoter.wallets?.[walletType] || {};

    return {
      success: true,
      data: {
        promoter: {
          id: promoter._id,
          username: promoter.username,
          email: promoter.email,
          role: promoter.role
        },
        wallet: {
          balance: wallet.balance || 0,
          reserved: wallet.reserved || 0,
          currency: wallet.currency || 'NGN',
          totalTransactions: wallet.transactions?.length || 0,
          walletType: walletType
        },
        recentTransactions: wallet.transactions?.slice(0, 10) || []
      }
    };
  } catch (error) {
    console.error('Failed to get promoter wallet details:', error);
    throw new Error(`Failed to get wallet details: ${error.message}`);
  }
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
static async validateRefund(promoterIdentifier, amount) {
  try {
    console.log('Validating refund:', { promoterIdentifier, amount });
    
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
      { email: promoterIdentifier }
    );
    
    // Also try uid if present
    query.$or.push({ uid: promoterIdentifier });
    
    // Only search for promoters or marketers
    query.role = { $in: ['promoter', 'marketer'] };
    
    console.log('Search query:', JSON.stringify(query, null, 2));
    
    const promoter = await UserModel.findOne(query);

    console.log('Found promoter:', promoter ? `Yes: ${promoter.username} (${promoter._id})` : 'No');
    
    if (!promoter) {
      return {
        valid: false,
        error: `User not found. Please check the identifier: ${promoterIdentifier}`
      };
    }

    // Check wallet based on role
    const walletType = promoter.role === 'promoter' ? 'promoter' : 'marketer';
    
    if (!promoter.wallets?.[walletType]) {
      return {
        valid: false,
        error: `${promoter.role} wallet not found`
      };
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

    // Get current balance
    const currentBalance = promoter.wallets[walletType].balance || 0;
    
    return {
      valid: true,
      data: {
        promoter: {
          id: promoter._id,
          username: promoter.username,
          email: promoter.email,
          role: promoter.role,
          accountAge: new Date() - new Date(promoter.createdAt)
        },
        wallet: {
          currentBalance: currentBalance,
          newBalance: currentBalance + amount,
          currency: promoter.wallets[walletType].currency || 'NGN',
          walletType: walletType
        },
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