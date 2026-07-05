import { EngagementContractModel, EngagementEscrowModel } from '../models/engagement.model.js';
import { UserModel } from '../../user/models/user/index.js';
import { StoreModel } from '../../store/models/store/index.js';
import { sendEmail } from '../../../core/email.service.js';
import { wrapEmail, brandedButton } from '../../../core/brand-email.js';

// ── Marketer: Create contract ──
export async function createContract(req, res) {
  try {
    const { promoterId, storeId, tasks, payment, duration, contractTerms } = req.body;
    const marketerId = req.userId;

    if (!promoterId || !tasks?.length || !payment?.total) {
      return res.status(400).json({ success: false, message: 'promoterId, tasks, and payment.total are required' });
    }

    const promoter = await UserModel.findById(promoterId).lean();
    if (!promoter) return res.status(404).json({ success: false, message: 'Promoter not found' });

    // Deduct from marketer wallet
    const marketer = await UserModel.findById(marketerId).select('wallets.marketer.reserved').lean();
    const balance = marketer?.wallets?.marketer?.reserved || 0;
    if (balance < payment.total) {
      return res.status(400).json({ success: false, message: `Insufficient balance. Need ₦${payment.total}, wallet has ₦${balance}` });
    }
    await UserModel.findByIdAndUpdate(marketerId, { $inc: { 'wallets.marketer.reserved': -payment.total } });

    // Create contract
    const contract = await EngagementContractModel.create({
      marketerId,
      promoterId,
      storeId: storeId || null,
      status: 'pending',
      tasks,
      payment: {
        total: payment.total,
        released: 0,
        platformFee: 0.2,
        schedule: payment.schedule || 'on-completion',
        milestones: payment.milestones || []
      },
      duration: duration || {},
      contractTerms: contractTerms || ''
    });

    // Create escrow (funds held)
    const escrow = await EngagementEscrowModel.create({
      contractId: contract._id,
      marketerId,
      promoterId,
      amount: payment.total,
      released: 0,
      status: 'held',
      releaseSchedule: payment.schedule || 'on-completion'
    });

    contract.escrowId = escrow._id;
    await contract.save();

    // Notify promoter
    const marketerUser = await UserModel.findById(marketerId).select('displayName').lean();
    await sendEmail({
      to: promoter.email,
      subject: `New engagement contract from ${marketerUser?.displayName || 'a marketer'} — ₦${payment.total}`,
      html: wrapEmail({
        title: 'New Contract Offer',
        content: `<p>${marketerUser?.displayName || 'A marketer'} has created a contract for you. <strong>₦${payment.total}</strong> is held in escrow.</p>
          <p><strong>Schedule:</strong> ${payment.schedule}</p>
          <p><strong>Tasks:</strong> ${tasks.map(t => `${t.target}x ${t.type}`).join(', ')}</p>
          ${brandedButton('View Contract', `${process.env.FRONTEND_URL}/dashboard/contracts`)}`
      })
    }).catch(() => {});

    return res.status(201).json({ success: true, data: contract, escrow });
  } catch (err) {
    console.error('createContract error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ── Promoter: Accept / Decline contract ──
export async function respondToContract(req, res) {
  try {
    const { contractId } = req.params;
    const { action } = req.body; // 'accept' or 'decline'
    const promoterId = req.userId;

    const contract = await EngagementContractModel.findOne({ _id: contractId, promoterId });
    if (!contract) return res.status(404).json({ success: false, message: 'Contract not found' });
    if (contract.status !== 'pending') return res.status(400).json({ success: false, message: 'Contract already responded to' });

    if (action === 'accept') {
      contract.status = 'active';
      contract.duration.start = new Date();
    } else {
      contract.status = 'cancelled';
    }
    await contract.save();

    if (action === 'decline') {
      await EngagementEscrowModel.findByIdAndUpdate(contract.escrowId, { status: 'refunded' });
      // Refund marketer's wallet
      await UserModel.findByIdAndUpdate(contract.marketerId, {
        $inc: { 'wallets.marketer.reserved': contract.payment.total }
      });
      // Notify marketer
      const promoter = await UserModel.findById(promoterId).select('displayName').lean();
      const marketer = await UserModel.findById(contract.marketerId).select('email displayName').lean();
      await sendEmail({
        to: marketer?.email,
        subject: 'Promoter declined your contract — ₦' + contract.payment.total + ' refunded',
        html: wrapEmail({
          title: 'Contract Declined',
          content: `<p><strong>${promoter?.displayName || 'A promoter'}</strong> declined your engagement contract.</p>
            <p><strong>₦${contract.payment.total}</strong> has been refunded to your wallet.</p>
            ${brandedButton('Browse Promoters', `${process.env.FRONTEND_URL}/dashboard/marketer/hire`)}`
        })
      }).catch(() => {});
    }

    return res.status(200).json({ success: true, data: contract });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ── Promoter: Update task progress ──
export async function updateTaskProgress(req, res) {
  try {
    const { contractId } = req.params;
    const { taskIndex, completed } = req.body;
    const promoterId = req.userId;

    const contract = await EngagementContractModel.findOne({ _id: contractId, promoterId, status: 'active' });
    if (!contract) return res.status(404).json({ success: false, message: 'Active contract not found' });

    if (!contract.tasks[taskIndex]) return res.status(400).json({ success: false, message: 'Invalid task index' });

    const task = contract.tasks[taskIndex];
    task.completed = Math.min(completed || task.completed + 1, task.target);

    // Recalculate progress
    const totalTargets = contract.tasks.reduce((s, t) => s + t.target, 0);
    const totalCompleted = contract.tasks.reduce((s, t) => s + t.completed, 0);
    contract.progress = totalTargets > 0 ? Math.round((totalCompleted / totalTargets) * 100) : 0;

    // Check milestones
    if (contract.payment.schedule === 'milestone') {
      for (const ms of contract.payment.milestones) {
        if (!ms.completed && contract.progress >= ms.percent) {
          ms.completed = true;
          contract.status = 'milestone-review';
        }
      }
    }

    await contract.save();

    // Notify marketer on milestone
    if (contract.status === 'milestone-review') {
      const marketer = await UserModel.findById(contract.marketerId).select('email displayName').lean();
      await sendEmail({
        to: marketer?.email,
        subject: 'Promoter reached a milestone',
        html: wrapEmail({
          title: 'Milestone Reached',
          content: `<p>A promoter has reached ${contract.progress}% completion on their engagement contract.</p>
            ${brandedButton('Review Contract', `${process.env.FRONTEND_URL}/dashboard/marketer/contracts/${contract._id}`)}`
        })
      }).catch(() => {});
    }

    return res.status(200).json({ success: true, data: contract });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ── Marketer: Approve milestone / Complete contract ──
export async function approveMilestone(req, res) {
  try {
    const { contractId } = req.params;
    const { milestoneIndex } = req.body;
    const marketerId = req.userId;

    const contract = await EngagementContractModel.findOne({ _id: contractId, marketerId });
    if (!contract) return res.status(404).json({ success: false, message: 'Contract not found' });
    if (!['active', 'milestone-review'].includes(contract.status)) {
      return res.status(400).json({ success: false, message: 'Cannot approve in current status' });
    }

    const escrow = await EngagementEscrowModel.findById(contract.escrowId);
    if (!escrow) return res.status(404).json({ success: false, message: 'Escrow not found' });

    let releaseAmount = 0;

    if (contract.payment.schedule === 'milestone' && milestoneIndex !== undefined) {
      const ms = contract.payment.milestones[milestoneIndex];
      if (!ms || !ms.completed || ms.approvedBy) return res.status(400).json({ success: false, message: 'Invalid milestone' });
      ms.approvedBy = marketerId;
      ms.releasedAt = new Date();
      releaseAmount = Math.round(contract.payment.total * ms.percent / 100);
    } else if (contract.payment.schedule === 'on-completion') {
      // Full completion
      contract.status = 'completed';
      releaseAmount = contract.payment.total - contract.payment.released;
    }

    if (releaseAmount > 0) {
      contract.payment.released += releaseAmount;
      escrow.released += releaseAmount;
      escrow.releases.push({ amount: releaseAmount, reason: 'Milestone approved' });

      if (escrow.released >= escrow.amount) {
        escrow.status = 'fully-released';
      } else {
        escrow.status = 'partially-released';
      }

      // Credit promoter's wallet
      await UserModel.findByIdAndUpdate(contract.promoterId, {
        $inc: { 'wallets.promoter.reserved': releaseAmount }
      });
    }

    if (contract.progress >= 100) {
      contract.status = 'completed';
    }

    await contract.save();
    await escrow.save();

    return res.status(200).json({ success: true, data: contract, escrow });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ── List contracts (filtered by role) ──
export async function listContracts(req, res) {
  try {
    const userId = req.userId;
    const { role } = req.query; // 'marketer' or 'promoter'
    const filter = role === 'promoter' ? { promoterId: userId } : { marketerId: userId };

    const contracts = await EngagementContractModel.find(filter)
      .sort({ createdAt: -1 })
      .populate('marketerId', 'displayName avatar')
      .populate('promoterId', 'displayName avatar')
      .lean();

    return res.status(200).json({ success: true, data: contracts });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ── Get single contract ──
export async function getContract(req, res) {
  try {
    const { contractId } = req.params;
    const contract = await EngagementContractModel.findById(contractId)
      .populate('marketerId', 'displayName avatar email professionalInfo')
      .populate('promoterId', 'displayName avatar email professionalInfo')
      .lean();

    if (!contract) return res.status(404).json({ success: false, message: 'Contract not found' });

    const escrow = await EngagementEscrowModel.findById(contract.escrowId).lean();

    return res.status(200).json({ success: true, data: { ...contract, escrow } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ── Rate after completion ──
export async function rateContract(req, res) {
  try {
    const { contractId } = req.params;
    const { rating, review, role } = req.body; // role: 'marketer' or 'promoter'
    const userId = req.userId;

    const contract = await EngagementContractModel.findById(contractId);
    if (!contract || contract.status !== 'completed') return res.status(400).json({ success: false, message: 'Contract not completed' });
    if ((role === 'marketer' && String(contract.marketerId) !== userId) ||
        (role === 'promoter' && String(contract.promoterId) !== userId)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (role === 'marketer') {
      contract.marketerRating = { rating, review };
    } else {
      contract.promoterFeedback = { rating, review };
    }
    await contract.save();

    return res.status(200).json({ success: true, data: contract });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ── Dispute contract ──
export async function disputeContract(req, res) {
  try {
    const { contractId } = req.params;
    const { reason } = req.body;
    const userId = req.userId;

    const contract = await EngagementContractModel.findOne({
      _id: contractId,
      $or: [{ marketerId: userId }, { promoterId: userId }]
    });
    if (!contract) return res.status(404).json({ success: false, message: 'Contract not found' });
    if (!['active', 'milestone-review'].includes(contract.status)) {
      return res.status(400).json({ success: false, message: 'Can only dispute active contracts' });
    }

    contract.status = 'disputed';
    contract.contractTerms = (contract.contractTerms || '') + `\n[DISPUTED ${new Date().toISOString()} by ${String(contract.marketerId) === userId ? 'marketer' : 'promoter'}]: ${reason || 'No reason provided'}`;
    await contract.save();

    // Notify admin (logs to console for now; in production, send to admin email)
    console.log(`[DISPUTE] Contract ${contractId} disputed. Reason: ${reason}`);

    // Notify the other party
    const otherPartyId = String(contract.marketerId) === userId ? contract.promoterId : contract.marketerId;
    const otherParty = await UserModel.findById(otherPartyId).select('email displayName').lean();
    await sendEmail({
      to: otherParty?.email,
      subject: 'Contract has been disputed',
      html: wrapEmail({
        title: 'Contract Disputed',
        content: `<p>A contract you're involved in has been disputed.</p>
          <p><strong>Reason:</strong> ${reason || 'Not specified'}</p>
          <p>MarketSpase support will review this dispute within 48 hours.</p>
          ${brandedButton('View Contract', `${process.env.FRONTEND_URL}/dashboard/contracts/${contractId}`)}`
      })
    }).catch(() => {});

    return res.status(200).json({ success: true, data: contract });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ── Browse promoters to hire ──
export async function browsePromoters(req, res) {
  try {
    const promoters = await UserModel.find({ role: 'promoter', isActive: true })
      .select('displayName avatar professionalInfo wallet.reputation')
      .lean();

    // Get completed contract counts
    const promoterIds = promoters.map(p => p._id);
    const completedCounts = await EngagementContractModel.aggregate([
      { $match: { promoterId: { $in: promoterIds }, status: 'completed' } },
      { $group: { _id: '$promoterId', count: { $sum: 1 } } }
    ]);

    const countMap = new Map(completedCounts.map(c => [String(c._id), c.count]));

    const result = promoters.map(p => ({
      _id: p._id,
      displayName: p.displayName,
      avatar: p.avatar,
      reputation: p.wallet?.reputation || 0,
      completedContracts: countMap.get(String(p._id)) || 0
    }));

    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
