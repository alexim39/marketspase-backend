import express from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware.js';
import { requireAdmin } from '../../../shared/middleware/authorization.middleware.js';
import { EngagementContractModel, EngagementEscrowModel } from '../models/engagement.model.js';
import { UserModel } from '../../user/models/user/index.js';
import { sendEmail } from '../../../core/email.service.js';
import { wrapEmail, brandedButton } from '../../../core/brand-email.js';
import {
  createContract, respondToContract, updateTaskProgress, approveMilestone,
  listContracts, getContract, rateContract, browsePromoters, disputeContract
} from '../controllers/engagement.controller.js';
import { scoreComment, getDailySuggestions } from '../controllers/ai-engagement.controller.js';
import { claimMissionReward } from '../controllers/mission-claim.controller.js';

const router = express.Router();

router.use(authenticate);

// Marketer flows
router.post('/contracts', createContract);
router.post('/contracts/:contractId/approve', approveMilestone);

// Promoter flows
router.post('/contracts/:contractId/respond', respondToContract);
router.post('/contracts/:contractId/progress', updateTaskProgress);

// Shared
router.get('/contracts', listContracts);
router.get('/contracts/:contractId', getContract);
router.post('/contracts/:contractId/rate', rateContract);
router.post('/contracts/:contractId/dispute', disputeContract);

// Discovery
router.get('/promoters', browsePromoters);

// AI-powered
router.post('/score-comment', scoreComment);
router.get('/suggestions/daily', getDailySuggestions);
router.post('/missions/claim', claimMissionReward);
router.post('/missions/generate', async (req, res) => {
  try {
    const userId = req.userId;

    // Determine tier
    const user = await UserModel.findById(userId).select('loginStreak.currentStreak').lean();
    const streak = user?.loginStreak?.currentStreak || 0;
    const activeContracts = await EngagementContractModel.countDocuments({ promoterId: userId, status: 'active' });

    let tier, pool;
    if (streak >= 30 && activeContracts > 0) {
      tier = 'pro';
      pool = [
        { label: 'Pro Standard', requirements: [{ type: 'like', target: 20 }, { type: 'comment', target: 8 }, { type: 'share', target: 5 }], reward: 350 },
        { label: 'Pro Heavy', requirements: [{ type: 'like', target: 25 }, { type: 'comment', target: 10 }, { type: 'share', target: 6 }], reward: 450 },
      ];
    } else if (streak >= 7 || activeContracts > 0) {
      tier = 'regular';
      pool = [
        { label: 'Regular Standard', requirements: [{ type: 'like', target: 15 }, { type: 'comment', target: 5 }, { type: 'share', target: 3 }], reward: 200 },
        { label: 'Regular Plus', requirements: [{ type: 'like', target: 18 }, { type: 'comment', target: 6 }, { type: 'share', target: 3 }], reward: 250 },
      ];
    } else {
      tier = 'starter';
      pool = [
        { label: 'Starter Standard', requirements: [{ type: 'like', target: 10 }, { type: 'comment', target: 3 }], reward: 120 },
      ];
    }

    const template = pool[Math.floor(Math.random() * pool.length)];
    const today = new Date(); today.setHours(0, 0, 0, 0);

    await UserModel.findByIdAndUpdate(userId, {
      dailyMission: { date: today, label: template.label, requirements: template.requirements.map(r => ({ type: r.type, target: r.target, completed: 0 })), reward: template.reward, tier, completed: false, claimedAt: null }
    });

    const updated = await UserModel.findById(userId).select('dailyMission').lean();
    return res.status(200).json({ success: true, data: updated?.dailyMission });
  } catch (err) {
    console.error('mission-gen API error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Admin routes
router.get('/admin/disputes', requireAdmin, async (req, res) => {
  try {
    const contracts = await EngagementContractModel.find({ status: 'disputed' })
      .sort({ updatedAt: -1 })
      .populate('marketerId', 'displayName email')
      .populate('promoterId', 'displayName email')
      .lean();
    return res.status(200).json({ success: true, data: contracts });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/admin/contracts', requireAdmin, async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20, sort = 'createdAt', order = 'desc' } = req.query;

    const pipeline = [];
    const matchStage = {};

    if (status && status !== 'all') matchStage.status = status;
    if (matchStage.status) pipeline.push({ $match: matchStage });

    // Always lookup users for display
    pipeline.push(
      { $lookup: { from: 'users', localField: 'marketerId', foreignField: '_id', as: 'marketer' } },
      { $lookup: { from: 'users', localField: 'promoterId', foreignField: '_id', as: 'promoter' } }
    );

    // Search by marketer/promoter name or contract terms
    if (search && search.trim()) {
      const searchRegex = { $regex: search.trim(), $options: 'i' };
      pipeline.push({ $match: { $or: [
        { 'marketer.displayName': searchRegex },
        { 'promoter.displayName': searchRegex },
        { contractTerms: searchRegex }
      ]}});
    }

    // Count total before pagination
    const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await EngagementContractModel.aggregate(countPipeline);
    const total = countResult[0]?.total || 0;

    // Sort and paginate
    const sortObj = { [sort]: order === 'desc' ? -1 : 1 };
    pipeline.push({ $sort: sortObj });
    pipeline.push({ $skip: (Number(page) - 1) * Number(limit) });
    pipeline.push({ $limit: Number(limit) });

    const contracts = await EngagementContractModel.aggregate(pipeline);

    // Populate marketer/promoter for display (aggregation already has them as arrays from lookup)
    const shaped = contracts.map(c => ({
      ...c,
      marketerId: c.marketer?.[0] || c.marketerId,
      promoterId: c.promoter?.[0] || c.promoterId,
      marketer: undefined,
      promoter: undefined
    }));

    // Stats
    const stats = await EngagementContractModel.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 }, totalValue: { $sum: '$payment.total' } } }
    ]);
    const statsMap = {};
    let totalValue = 0;
    for (const s of stats) { statsMap[s._id] = s.count; totalValue += s.totalValue; }

    return res.status(200).json({
      success: true,
      data: shaped,
      stats: {
        total,
        active: statsMap.active || 0,
        completed: statsMap.completed || 0,
        disputed: statsMap.disputed || 0,
        pending: statsMap.pending || 0,
        cancelled: statsMap.cancelled || 0,
        totalValue
      },
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) }
    });
  } catch (err) {
    console.error('Admin contracts error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/admin/disputes/:contractId/resolve', requireAdmin, async (req, res) => {
  try {
    const { contractId } = req.params;
    const { resolution } = req.body; // 'refund-marketer' | 'release-promoter'

    const contract = await EngagementContractModel.findById(contractId);
    if (!contract || contract.status !== 'disputed') {
      return res.status(404).json({ success: false, message: 'Disputed contract not found' });
    }

    const escrow = await EngagementEscrowModel.findById(contract.escrowId);

    if (resolution === 'refund-marketer') {
      contract.status = 'cancelled';
      if (escrow) {
        const remaining = escrow.amount - escrow.released;
        if (remaining > 0) {
          await UserModel.findByIdAndUpdate(contract.marketerId, { $inc: { 'wallets.marketer.reserved': remaining } });
        }
        escrow.status = 'refunded';
        await escrow.save();
      }
    } else if (resolution === 'release-promoter') {
      contract.status = 'completed';
      if (escrow) {
        const remaining = escrow.amount - escrow.released;
        if (remaining > 0) {
          escrow.released += remaining;
          escrow.releases.push({ amount: remaining, reason: 'Admin resolution — released to promoter' });
          escrow.status = 'fully-released';
          await escrow.save();
          await UserModel.findByIdAndUpdate(contract.promoterId, { $inc: { 'wallets.promoter.reserved': remaining } });
        }
      }
    }

    await contract.save();

    // Notify both parties
    const [marketer, promoter] = await Promise.all([
      UserModel.findById(contract.marketerId).select('email displayName').lean(),
      UserModel.findById(contract.promoterId).select('email displayName').lean()
    ]);
    const resolutionText = resolution === 'refund-marketer' ? 'resolved in the marketer\'s favor — funds refunded' : 'resolved in the promoter\'s favor — payment released';
    await sendEmail({
      to: marketer?.email, subject: 'Dispute resolved',
      html: wrapEmail({ title: 'Dispute Resolved', content: `<p>Admin has ${resolutionText}.</p>` })
    }).catch(() => {});
    await sendEmail({
      to: promoter?.email, subject: 'Dispute resolved',
      html: wrapEmail({ title: 'Dispute Resolved', content: `<p>Admin has ${resolutionText}.</p>` })
    }).catch(() => {});

    return res.status(200).json({ success: true, data: contract });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
