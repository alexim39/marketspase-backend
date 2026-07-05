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
