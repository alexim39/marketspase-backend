import { UserModel } from '../../user/models/user/index.js';
import mongoose from 'mongoose';
import {
  RecoveryAuditModel,
  logRecoveryDraft,
  confirmRecoveryDraft,
  completeRecovery,
  cancelRecovery,
  getRecoveryHistory,
  getUserRecoverySummary,
} from '../services/recovery-audit.service.js';

/**
 * Admin Fund Recovery Controller
 *
 * Handles deducting funds from a user's wallet (promoter or marketer)
 * as a recovery/requisition action. Uses a two-step workflow:
 *   1. Draft: Admin submits a recovery request for review
 *   2. Confirm: Admin confirms → triggers the actual deduction
 *
 * All actions are securely logged in an immutable audit trail.
 */

/**
 * GET /api/v1/financial/recovery/user/:identifier
 * Retrieve user details for recovery: balance, recent transactions, flags
 */
export async function getUserForRecovery(req, res) {
  try {
    const { identifier } = req.params;

    const query = buildUserQuery(identifier);
    const user = await UserModel.findOne(query)
      .select('username email displayName role wallets isActive isDeleted fraudProfile createdAt');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.isDeleted) {
      return res.status(400).json({
        success: false,
        message: 'This account has been deleted and cannot be recovered from',
      });
    }

    // Build wallet info
    const wallets = {};
    for (const walletType of ['promoter', 'marketer']) {
      if (user.wallets?.[walletType]) {
        const wallet = user.wallets[walletType];
        wallets[walletType] = {
          balance: wallet.balance || 0,
          reserved: wallet.reserved || 0,
          available: Math.max(0, (wallet.balance || 0) - (wallet.reserved || 0)),
          currency: wallet.currency || 'NGN',
          recentTransactions: (wallet.transactions || [])
            .slice(0, 10)
            .map(tx => ({
              _id: tx._id,
              amount: tx.amount,
              type: tx.type,
              category: tx.category,
              description: tx.description,
              status: tx.status,
              createdAt: tx.createdAt || tx.processedAt,
              reference: tx.reference,
            })),
        };
      }
    }

    // Check for previous flags / disputes
    const recoverySummary = await getUserRecoverySummary(user._id);

    return res.status(200).json({
      success: true,
      data: {
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt,
        },
        wallets,
        fraudProfile: user.fraudProfile || {},
        recoveryHistory: recoverySummary,
      },
    });
  } catch (error) {
    console.error('Error fetching user for recovery:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch user details',
    });
  }
}

/**
 * POST /api/v1/financial/recovery/draft
 * Step 1: Create a draft recovery request (no actual deduction yet)
 */
export async function createRecoveryDraft(req, res) {
  try {
    const { targetUserId, amount, reason, walletType, metadata } = req.body;
    const adminId = req.userId || req.user?._id;
    const adminUsername = req.user?.username || 'admin';
    const ipAddress = req.ip || req.socket?.remoteAddress;
    const userAgent = req.headers['user-agent'];

    // Validate required fields
    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'Target user ID is required' });
    }
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'A valid amount greater than 0 is required' });
    }
    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({ success: false, message: 'Reason is required and must be at least 10 characters' });
    }
    if (!walletType || !['promoter', 'marketer'].includes(walletType)) {
      return res.status(400).json({ success: false, message: 'Wallet type must be "promoter" or "marketer"' });
    }
    if (amount > 1000000) {
      return res.status(400).json({ success: false, message: 'Recovery amount cannot exceed ₦1,000,000' });
    }

    // Find the target user
    const user = await UserModel.findById(targetUserId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Target user not found' });
    }
    if (user.isDeleted) {
      return res.status(400).json({ success: false, message: 'Cannot recover from a deleted account' });
    }

    // Validate wallet exists and has sufficient balance
    const wallet = user.wallets?.[walletType];
    if (!wallet) {
      return res.status(400).json({ success: false, message: `${walletType} wallet not found for this user` });
    }

    const availableBalance = Math.max(0, (wallet.balance || 0) - (wallet.reserved || 0));
    if (amount > availableBalance) {
      return res.status(400).json({
        success: false,
        message: `Insufficient available balance. Available: ₦${availableBalance.toLocaleString()}, Requested: ₦${amount.toLocaleString()}`,
      });
    }

    // Cannot recover marketer wallet funds that are locked for in-app use
    // (Technically all marketer wallet funds are "locked", but admin can still recover them)
    // This is a policy decision — we allow it with a warning

    // Log the draft
    const audit = await logRecoveryDraft({
      targetUser: user,
      walletType,
      amount,
      reason,
      adminId,
      adminUsername,
      ipAddress,
      userAgent,
      metadata: { ...metadata, source: 'admin-dashboard' },
    });

    // Also append a lightweight entry to user's activityLog
    try {
      await UserModel.updateOne(
        { _id: user._id },
        {
          $push: {
            activityLog: {
              $each: [{
                action: 'system_event',
                description: `Fund recovery draft created: ₦${amount.toLocaleString()} from ${walletType} wallet. Reason: ${reason}`,
                resourceType: 'wallet',
                resourceId: user._id,
                metadata: {
                  recoveryAuditId: audit._id,
                  amount,
                  walletType,
                  reason,
                  status: 'draft',
                },
                severity: 'warning',
                timestamp: new Date(),
              }],
              $position: 0,
              $slice: 1000,
            },
          },
        }
      );
    } catch (logError) {
      console.warn('Failed to log activity for recovery draft:', logError.message);
    }

    return res.status(200).json({
      success: true,
      message: `Recovery draft created: ₦${amount.toLocaleString()} from ${user.username}'s ${walletType} wallet`,
      data: {
        auditId: audit._id,
        status: audit.status,
        targetUser: {
          _id: user._id,
          username: user.username,
          email: user.email,
        },
        wallet: {
          type: walletType,
          currentBalance: wallet.balance,
          availableBalance,
          newBalanceAfterRecovery: wallet.balance - amount,
        },
        recovery: {
          amount,
          reason,
          requestedAt: audit.requestedAt,
        },
      },
    });
  } catch (error) {
    console.error('Error creating recovery draft:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to create recovery draft',
    });
  }
}

/**
 * POST /api/v1/financial/recovery/confirm
 * Step 2: Confirm a draft recovery → execute the actual deduction
 */
export async function confirmRecovery(req, res) {
  const session = await mongoose.startSession();
  let transactionCommitted = false;

  try {
    const { auditId } = req.body;
    const adminId = req.userId || req.user?._id;
    const adminUsername = req.user?.username || 'admin';
    const ipAddress = req.ip || req.socket?.remoteAddress;

    if (!auditId) {
      return res.status(400).json({ success: false, message: 'Audit ID is required' });
    }

    session.startTransaction();

    // Fetch the audit record
    const audit = await RecoveryAuditModel.findById(auditId).session(session);
    if (!audit) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Recovery request not found' });
    }
    if (audit.status !== 'draft') {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Recovery request is already in status: ${audit.status}. Only draft requests can be confirmed.`,
      });
    }

    // Ensure the same admin who drafted confirms (or allow any admin — policy decision)
    // Here we allow any admin to confirm

    // Fetch the target user and validate
    const user = await UserModel.findById(audit.targetUser).session(session);
    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Target user no longer exists' });
    }

    const wallet = user.wallets?.[audit.walletType];
    if (!wallet) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `${audit.walletType} wallet no longer exists for this user`,
      });
    }

    const availableBalance = Math.max(0, (wallet.balance || 0) - (wallet.reserved || 0));
    if (audit.amount > availableBalance) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Insufficient balance at time of confirmation. Available: ₦${availableBalance.toLocaleString()}`,
      });
    }

    // Generate transaction reference
    const reference = `REC-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const transactionId = new mongoose.Types.ObjectId();

    // Record previous balance
    const previousBalance = wallet.balance;

    // --- EXECUTE THE DEDUCTION ---
    wallet.balance -= audit.amount;

    // Add a debit transaction record to the wallet
    const debitTransaction = {
      _id: transactionId,
      reference,
      amount: audit.amount,
      type: 'debit',
      category: 'refund',
      description: `Fund recovery: ${audit.reason}`,
      status: 'completed',
      gateway: 'system',
      currency: wallet.currency || 'NGN',
      processedAt: new Date(),
      meta: {
        recoveryAuditId: audit._id,
        recoveryReason: audit.reason,
        processedByAdmin: adminId,
        processedByUsername: adminUsername,
      },
    };

    wallet.transactions = wallet.transactions || [];
    wallet.transactions.unshift(debitTransaction);

    // Save user
    await user.save({ session, validateModifiedOnly: true });

    // Update audit trail
    audit.status = 'confirmed';
    audit.confirmedBy = adminId;
    audit.confirmedByUsername = adminUsername;
    audit.confirmedAt = new Date();
    audit.transactionId = String(transactionId);
    audit.transactionReference = reference;
    audit.previousBalance = previousBalance;
    audit.newBalance = wallet.balance;
    await audit.save({ session });

    // Also log to user's activityLog
    try {
      await UserModel.updateOne(
        { _id: user._id },
        {
          $push: {
            activityLog: {
              $each: [{
                action: 'system_event',
                description: `Fund recovery executed: ₦${audit.amount.toLocaleString()} deducted from ${audit.walletType} wallet. Reference: ${reference}`,
                resourceType: 'wallet',
                resourceId: user._id,
                metadata: {
                  recoveryAuditId: audit._id,
                  amount: audit.amount,
                  walletType: audit.walletType,
                  reference,
                  reason: audit.reason,
                  status: 'completed',
                  previousBalance,
                  newBalance: wallet.balance,
                  confirmedBy: adminUsername,
                },
                severity: 'warning',
                timestamp: new Date(),
              }],
              $position: 0,
              $slice: 1000,
            },
          },
        }
      ).session(session);
    } catch (logError) {
      console.warn('Failed to log activity for recovery confirmation:', logError.message);
    }

    await session.commitTransaction();
    transactionCommitted = true;

    return res.status(200).json({
      success: true,
      message: `Successfully recovered ₦${audit.amount.toLocaleString()} from ${user.username}'s ${audit.walletType} wallet`,
      data: {
        auditId: audit._id,
        transactionId: String(transactionId),
        reference,
        amount: audit.amount,
        walletType: audit.walletType,
        reason: audit.reason,
        previousBalance,
        newBalance: wallet.balance,
        confirmedBy: adminUsername,
        confirmedAt: audit.confirmedAt,
        status: audit.status,
      },
    });
  } catch (error) {
    if (session.transaction.isActive && !transactionCommitted) {
      await session.abortTransaction();
    }
    console.error('Error confirming recovery:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to confirm recovery',
    });
  } finally {
    await session.endSession();
  }
}

/**
 * POST /api/v1/financial/recovery/cancel
 * Cancel a draft recovery request
 */
export async function cancelRecoveryRequest(req, res) {
  try {
    const { auditId, reason } = req.body;
    const adminId = req.userId || req.user?._id;

    if (!auditId) {
      return res.status(400).json({ success: false, message: 'Audit ID is required' });
    }

    const audit = await cancelRecovery(auditId, adminId, reason || 'Cancelled by admin');

    return res.status(200).json({
      success: true,
      message: 'Recovery request cancelled',
      data: {
        auditId: audit._id,
        status: audit.status,
        cancelledAt: audit.cancelledAt,
      },
    });
  } catch (error) {
    console.error('Error cancelling recovery:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to cancel recovery',
    });
  }
}

/**
 * GET /api/v1/financial/recovery/history
 * Get recovery history with filters
 */
export async function getRecoveryHistoryHandler(req, res) {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      targetUserId,
      adminId,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      walletType,
    } = req.query;

    const result = await getRecoveryHistory({
      page,
      limit,
      status,
      targetUserId,
      adminId,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      walletType,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error fetching recovery history:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch recovery history',
    });
  }
}

/**
 * GET /api/v1/financial/recovery/audit/:id
 * Get a single recovery audit record by ID
 */
export async function getRecoveryAuditById(req, res) {
  try {
    const { id } = req.params;

    const audit = await RecoveryAuditModel.findById(id).lean();
    if (!audit) {
      return res.status(404).json({ success: false, message: 'Recovery record not found' });
    }

    return res.status(200).json({
      success: true,
      data: audit,
    });
  } catch (error) {
    console.error('Error fetching recovery audit:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch recovery record',
    });
  }
}

/**
 * Search users for recovery
 * GET /api/v1/financial/recovery/search?query=...
 */
export async function searchUsersForRecovery(req, res) {
  try {
    const { query } = req.query;

    if (!query || query.length < 2) {
      return res.status(200).json({
        success: true,
        data: [],
      });
    }

    const users = await UserModel.find({
      $or: [
        { username: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
        { displayName: { $regex: query, $options: 'i' } },
      ],
      role: { $in: ['promoter', 'marketer'] },
      isActive: true,
      isDeleted: false,
    })
      .limit(10)
      .select('_id username email displayName role wallets isActive createdAt');

    const formattedUsers = users.map(user => {
      const wallets = {};
      if (user.wallets?.promoter) {
        wallets.promoter = {
          balance: user.wallets.promoter.balance || 0,
          reserved: user.wallets.promoter.reserved || 0,
          available: Math.max(0, (user.wallets.promoter.balance || 0) - (user.wallets.promoter.reserved || 0)),
          currency: user.wallets.promoter.currency || 'NGN',
        };
      }
      if (user.wallets?.marketer) {
        wallets.marketer = {
          balance: user.wallets.marketer.balance || 0,
          reserved: user.wallets.marketer.reserved || 0,
          available: Math.max(0, (user.wallets.marketer.balance || 0) - (user.wallets.marketer.reserved || 0)),
          currency: user.wallets.marketer.currency || 'NGN',
        };
      }
      return {
        _id: user._id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        wallets,
        isActive: user.isActive,
        createdAt: user.createdAt,
      };
    });

    return res.status(200).json({
      success: true,
      data: formattedUsers,
    });
  } catch (error) {
    console.error('Error searching users for recovery:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to search users',
    });
  }
}

/**
 * Validate a recovery amount and wallet
 * POST /api/v1/financial/recovery/validate
 */
export async function validateRecovery(req, res) {
  try {
    const { targetUserId, amount, walletType } = req.body;

    if (!targetUserId || !amount || !walletType) {
      return res.status(200).json({
        success: true,
        data: { valid: false, error: 'Missing required parameters' },
      });
    }

    if (!['promoter', 'marketer'].includes(walletType)) {
      return res.status(200).json({
        success: true,
        data: { valid: false, error: 'Invalid wallet type' },
      });
    }

    const user = await UserModel.findById(targetUserId)
      .select('username email displayName role wallets');

    if (!user) {
      return res.status(200).json({
        success: true,
        data: { valid: false, error: 'User not found' },
      });
    }

    const wallet = user.wallets?.[walletType];
    if (!wallet) {
      return res.status(200).json({
        success: true,
        data: { valid: false, error: `${walletType} wallet not found for this user` },
      });
    }

    const availableBalance = Math.max(0, (wallet.balance || 0) - (wallet.reserved || 0));

    if (amount <= 0) {
      return res.status(200).json({
        success: true,
        data: { valid: false, error: 'Amount must be greater than zero' },
      });
    }

    if (amount > 1000000) {
      return res.status(200).json({
        success: true,
        data: { valid: false, error: 'Recovery amount cannot exceed ₦1,000,000' },
      });
    }

    if (amount > availableBalance) {
      return res.status(200).json({
        success: true,
        data: {
          valid: false,
          error: `Insufficient available balance. Available: ₦${availableBalance.toLocaleString()}`,
          data: {
            user: { id: user._id, username: user.username, displayName: user.displayName },
            wallet: {
              type: walletType,
              balance: wallet.balance,
              reserved: wallet.reserved,
              available: availableBalance,
              currency: wallet.currency || 'NGN',
            },
          },
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        valid: true,
        data: {
          user: {
            _id: user._id,
            username: user.username,
            email: user.email,
            displayName: user.displayName,
            role: user.role,
          },
          wallet: {
            type: walletType,
            balance: wallet.balance,
            reserved: wallet.reserved,
            available: availableBalance,
            newBalance: wallet.balance - amount,
            currency: wallet.currency || 'NGN',
          },
          validation: {
            amount,
            maximumAllowed: Math.min(availableBalance, 1000000),
            isValidAmount: amount <= availableBalance && amount <= 1000000,
          },
        },
      },
    });
  } catch (error) {
    console.error('Recovery validation error:', error);
    return res.status(500).json({
      success: true,
      data: { valid: false, error: error.message || 'Validation failed' },
    });
  }
}

// --- Helpers ---

function buildUserQuery(identifier) {
  const query = { $or: [], isDeleted: false };

  if (mongoose.Types.ObjectId.isValid(identifier)) {
    query.$or.push({ _id: new mongoose.Types.ObjectId(identifier) });
  }

  query.$or.push(
    { username: identifier },
    { email: identifier },
    { uid: identifier },
  );

  return query;
}
