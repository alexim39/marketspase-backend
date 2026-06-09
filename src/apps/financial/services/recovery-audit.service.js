import { UserModel } from '../../user/models/user/index.js';
import mongoose from 'mongoose';

/**
 * Recovery Audit Service
 * 
 * Tracks all fund recovery (requisition) actions performed by admins.
 * Logs are stored in a separate RecoveryAudit collection for security
 * and immutability, plus a lightweight reference is appended to the 
 * user's activityLog for visibility.
 */

const recoveryAuditSchema = new mongoose.Schema({
  // The user who was recovered from
  targetUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  targetUserUsername: { type: String, required: true },
  targetUserEmail: { type: String },
  targetUserRole: { type: String, enum: ['promoter', 'marketer'], required: true },

  // Which wallet was debited
  walletType: {
    type: String,
    enum: ['promoter', 'marketer'],
    required: true,
  },

  // Recovery details
  amount: { type: Number, required: true, min: 0 },
  reason: { type: String, required: true },
  previousBalance: { type: Number, required: true },
  newBalance: { type: Number, required: true },

  // State machine: draft -> confirmed -> completed (or cancelled)
  status: {
    type: String,
    enum: ['draft', 'confirmed', 'completed', 'cancelled'],
    default: 'draft',
    index: true,
  },

  // Admin who performed the action
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  requestedByUsername: { type: String, required: true },

  confirmedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  confirmedByUsername: { type: String },

  // Timestamps for each step
  requestedAt: { type: Date, default: Date.now },
  confirmedAt: { type: Date },
  completedAt: { type: Date },
  cancelledAt: { type: Date },
  cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  cancellationReason: { type: String },

  // Transaction ID generated after deduction
  transactionId: { type: String },
  transactionReference: { type: String },

  // Additional metadata
  metadata: { type: mongoose.Schema.Types.Mixed },

  // IP / session info (optional audit enhancement)
  ipAddress: { type: String },
  userAgent: { type: String },
}, {
  timestamps: true,
});

// Index for efficient querying
recoveryAuditSchema.index({ status: 1, createdAt: -1 });
recoveryAuditSchema.index({ requestedBy: 1, createdAt: -1 });

export const RecoveryAuditModel = mongoose.model('RecoveryAudit', recoveryAuditSchema);

/**
 * Log a recovery request creation (draft)
 */
export async function logRecoveryDraft({
  targetUser,
  walletType,
  amount,
  reason,
  adminId,
  adminUsername,
  ipAddress,
  userAgent,
  metadata = {},
}) {
  const audit = new RecoveryAuditModel({
    targetUser: targetUser._id,
    targetUserUsername: targetUser.username,
    targetUserEmail: targetUser.email,
    targetUserRole: walletType === 'promoter' ? 'promoter' : 'marketer',
    walletType,
    amount,
    reason,
    previousBalance: (targetUser.wallets?.[walletType]?.balance || 0),
    newBalance: (targetUser.wallets?.[walletType]?.balance || 0) - amount,
    status: 'draft',
    requestedBy: adminId,
    requestedByUsername: adminUsername,
    requestedAt: new Date(),
    metadata,
    ipAddress,
    userAgent,
  });

  await audit.save();
  return audit;
}

/**
 * Confirm a draft recovery (step 2)
 */
export async function confirmRecoveryDraft({
  auditId,
  adminId,
  adminUsername,
  transactionId,
  transactionReference,
  ipAddress,
}) {
  const audit = await RecoveryAuditModel.findById(auditId);
  if (!audit) {
    throw new Error('Recovery audit record not found');
  }
  if (audit.status !== 'draft') {
    throw new Error(`Recovery request is already in status: ${audit.status}`);
  }

  audit.status = 'confirmed';
  audit.confirmedBy = adminId;
  audit.confirmedByUsername = adminUsername;
  audit.confirmedAt = new Date();
  audit.transactionId = transactionId;
  audit.transactionReference = transactionReference;
  if (ipAddress) audit.ipAddress = ipAddress;

  await audit.save();
  return audit;
}

/**
 * Mark a recovery as completed
 */
export async function completeRecovery(auditId) {
  const audit = await RecoveryAuditModel.findById(auditId);
  if (!audit) {
    throw new Error('Recovery audit record not found');
  }

  audit.status = 'completed';
  audit.completedAt = new Date();

  await audit.save();
  return audit;
}

/**
 * Cancel a recovery request
 */
export async function cancelRecovery(auditId, adminId, reason) {
  const audit = await RecoveryAuditModel.findById(auditId);
  if (!audit) {
    throw new Error('Recovery audit record not found');
  }
  if (audit.status === 'completed') {
    throw new Error('Cannot cancel a completed recovery');
  }

  audit.status = 'cancelled';
  audit.cancelledAt = new Date();
  audit.cancelledBy = adminId;
  audit.cancellationReason = reason || 'Cancelled by admin';

  await audit.save();
  return audit;
}

/**
 * Get recovery history with filters
 */
export async function getRecoveryHistory({
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
} = {}) {
  const filter = {};

  if (status) filter.status = status;
  if (targetUserId) filter.targetUser = new mongoose.Types.ObjectId(targetUserId);
  if (adminId) filter.requestedBy = new mongoose.Types.ObjectId(adminId);
  if (walletType) filter.walletType = walletType;

  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }

  if (minAmount || maxAmount) {
    filter.amount = {};
    if (minAmount) filter.amount.$gte = Number(minAmount);
    if (maxAmount) filter.amount.$lte = Number(maxAmount);
  }

  const skip = (Math.max(1, Number(page)) - 1) * Math.min(100, Math.max(1, Number(limit)));

  const [records, total] = await Promise.all([
    RecoveryAuditModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Math.min(100, Math.max(1, Number(limit))))
      .lean(),
    RecoveryAuditModel.countDocuments(filter),
  ]);

  return {
    records,
    pagination: {
      page: Math.max(1, Number(page)),
      limit: Math.min(100, Math.max(1, Number(limit))),
      total,
      totalPages: Math.ceil(total / Math.min(100, Math.max(1, Number(limit)))),
    },
  };
}

/**
 * Get user's recovery summary (disputes/flags info)
 */
export async function getUserRecoverySummary(userId) {
  const completedRecoveries = await RecoveryAuditModel.find({
    targetUser: userId,
    status: { $in: ['completed', 'confirmed'] },
  })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

  const totalRecovered = completedRecoveries.reduce(
    (sum, r) => sum + (r.status === 'completed' || r.status === 'confirmed' ? r.amount : 0),
    0
  );

  const pendingDrafts = await RecoveryAuditModel.countDocuments({
    targetUser: userId,
    status: 'draft',
  });

  return {
    totalRecovered,
    completedCount: completedRecoveries.filter(r => r.status === 'completed').length,
    pendingDrafts,
    recentRecoveries: completedRecoveries.slice(0, 5),
  };
}
