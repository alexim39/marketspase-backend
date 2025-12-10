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
    session.startTransaction();

    try {
      // Find the promoter user
      const promoter = await UserModel.findOne({
        $or: [
          { _id: promoterUserId },
          { uid: promoterUserId },
          { username: promoterUserId }
        ],
        role: 'promoter',
        isActive: true,
        isDeleted: false
      }).session(session);

      if (!promoter) {
        throw new Error('Promoter not found or inactive');
      }

      // Check if promoter has a wallet
      if (!promoter.wallets?.promoter) {
        throw new Error('Promoter wallet not found');
      }

      // Create transaction record for the refund
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

      // Update promoter's wallet balance
      const previousBalance = promoter.wallets.promoter.balance || 0;
      promoter.wallets.promoter.balance = previousBalance + amount;
      
      // Add transaction to wallet
      if (!promoter.wallets.promoter.transactions) {
        promoter.wallets.promoter.transactions = [];
      }
      promoter.wallets.promoter.transactions.unshift(transaction);

      // Log the refund activity for the promoter
      await promoter.logActivity('refund_received', `Received refund of ${amount} NGN from admin`, {
        resourceType: 'transaction',
        resourceId: transaction._id,
        metadata: {
          amount,
          reason,
          adminId,
          previousBalance,
          newBalance: promoter.wallets.promoter.balance
        }
      });

      // Log admin activity (optional - you might have an admin activity log)
      // This would require fetching admin user and logging their activity
      const admin = await UserModel.findById(adminId).session(session);
      if (admin) {
        await admin.logActivity('admin_refund_issued', `Issued refund of ${amount} NGN to promoter ${promoter.username}`, {
          resourceType: 'user',
          resourceId: promoter._id,
          metadata: {
            promoterId: promoter._id,
            promoterUsername: promoter.username,
            amount,
            reason,
            transactionId: transaction._id
          }
        });
      }

      // Save promoter changes
      await promoter.save({ session });

      // Commit transaction
      await session.commitTransaction();
      session.endSession();

      return {
        success: true,
        message: `Successfully refunded ${amount} NGN to promoter ${promoter.username}`,
        data: {
          transactionId: transaction._id,
          promoter: {
            id: promoter._id,
            username: promoter.username,
            email: promoter.email,
            previousBalance,
            newBalance: promoter.wallets.promoter.balance
          },
          refundDetails: {
            amount,
            reason,
            processedBy: adminId,
            processedAt: new Date()
          }
        }
      };

    } catch (error) {
      // Rollback transaction on error
      await session.abortTransaction();
      session.endSession();
      
      console.error('Refund failed:', error);
      throw new Error(`Refund failed: ${error.message}`);
    }
  }

  /**
   * Get promoter's current balance and transaction history
   * @param {string} promoterIdentifier - User ID, username, or email
   * @returns {Promise<Object>} Promoter wallet details
   */
  static async getPromoterWalletDetails(promoterIdentifier) {
    try {
      const promoter = await UserModel.findOne({
        $or: [
          { _id: promoterIdentifier },
          { uid: promoterIdentifier },
          { username: promoterIdentifier },
          { email: promoterIdentifier }
        ],
        role: 'promoter',
        isActive: true,
        isDeleted: false
      }).select('username email role wallets.promoter');

      if (!promoter) {
        throw new Error('Promoter not found');
      }

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
            balance: promoter.wallets?.promoter?.balance || 0,
            reserved: promoter.wallets?.promoter?.reserved || 0,
            currency: promoter.wallets?.promoter?.currency || 'NGN',
            totalTransactions: promoter.wallets?.promoter?.transactions?.length || 0
          },
          recentTransactions: promoter.wallets?.promoter?.transactions?.slice(0, 10) || []
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
   * @param {string} promoterUserId - Promoter identifier
   * @param {number} amount - Amount to refund
   * @returns {Promise<Object>} Validation result
   */
  static async validateRefund(promoterUserId, amount) {
    try {
      const promoter = await UserModel.findOne({
        $or: [
          { _id: promoterUserId },
          { uid: promoterUserId },
          { username: promoterUserId }
        ],
        role: 'promoter',
        isActive: true,
        isDeleted: false
      });

      if (!promoter) {
        return {
          valid: false,
          error: 'Promoter not found or inactive'
        };
      }

      if (!promoter.wallets?.promoter) {
        return {
          valid: false,
          error: 'Promoter wallet not found'
        };
      }

      if (amount <= 0) {
        return {
          valid: false,
          error: 'Refund amount must be greater than zero'
        };
      }

      // Additional business logic validations can be added here
      // For example:
      // - Maximum refund limit per day
      // - Promoter's account age restrictions
      // - Recent suspicious activity checks

      return {
        valid: true,
        data: {
          promoter: {
            id: promoter._id,
            username: promoter.username,
            email: promoter.email,
            accountAge: new Date() - new Date(promoter.createdAt)
          },
          wallet: {
            currentBalance: promoter.wallets.promoter.balance || 0,
            newBalance: (promoter.wallets.promoter.balance || 0) + amount,
            currency: promoter.wallets.promoter.currency || 'NGN'
          },
          validation: {
            amount,
            maximumAllowed: 1000000, // Example: 1,000,000 NGN limit
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
}

// Export as default
export default AdminRefundController;