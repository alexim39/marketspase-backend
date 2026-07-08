import cron from 'node-cron';
import { EngagementContractModel, EngagementEscrowModel } from '../models/engagement.model.js';
import { UserModel } from '../../user/models/user/index.js';
import { sendEmail } from '../../../core/email.service.js';
import { wrapEmail, brandedButton } from '../../../core/brand-email.js';

const AUTO_APPROVE_HOURS = 48;

async function autoApproveMilestones() {
  try {
    const cutoff = new Date(Date.now() - AUTO_APPROVE_HOURS * 60 * 60 * 1000);

    // Find contracts in milestone-review with un-approved milestones older than 48h
    const contracts = await EngagementContractModel.find({
      status: { $in: ['milestone-review', 'active'] },
      'payment.milestones': { $exists: true, $not: { $size: 0 } }
    });

    let autoApproved = 0;
    for (const contract of contracts) {
      let changed = false;

      for (const ms of contract.payment.milestones) {
        if (ms.completed && !ms.approvedBy) {
          // Check if the milestone was completed more than 48h ago via updatedAt
          const updatedAt = contract.updatedAt || contract.createdAt;
          if (new Date(updatedAt) < cutoff) {
            const releaseAmount = Math.round(contract.payment.total * ms.percent / 100);

            ms.approvedBy = null; // null = auto-approved
            ms.releasedAt = new Date();
            contract.payment.released += releaseAmount;

            const escrow = await EngagementEscrowModel.findById(contract.escrowId);
            if (escrow) {
              escrow.released += releaseAmount;
              escrow.releases.push({ amount: releaseAmount, reason: 'Auto-approved (48h timeout)' });
              if (escrow.released >= escrow.amount) escrow.status = 'fully-released';
              else escrow.status = 'partially-released';
              await escrow.save();
            }

            await UserModel.findByIdAndUpdate(contract.promoterId, {
              $inc: { 'wallets.promoter.reserved': releaseAmount }
            });

            changed = true;
            autoApproved++;
          }
        }
      }

      if (changed) {
        if (contract.progress >= 100) contract.status = 'completed';
        await contract.save();

        // Notify both parties
        const [marketer, promoter] = await Promise.all([
          UserModel.findById(contract.marketerId).select('email displayName').lean(),
          UserModel.findById(contract.promoterId).select('email displayName').lean()
        ]);

        await sendEmail({
          to: marketer?.email,
          subject: 'Milestone auto-approved',
          html: wrapEmail({
            title: 'Auto-Approved',
            content: `<p>A milestone on your engagement contract was auto-approved after ${AUTO_APPROVE_HOURS} hours of inactivity.</p>
              <p><strong>Promoter:</strong> ${promoter?.displayName}</p>
              ${brandedButton('View Contract', `${process.env.FRONTEND_URL}/dashboard/contracts/${contract._id}`)}`
          })
        }).catch(() => {});

        await sendEmail({
          to: promoter?.email,
          subject: 'Payment released (auto-approved)',
          html: wrapEmail({
            title: 'Payment Released',
            content: `<p>A milestone payment was auto-released to your wallet after the marketer didn't respond within ${AUTO_APPROVE_HOURS} hours.</p>
              ${brandedButton('View Contracts', `${process.env.FRONTEND_URL}/dashboard/contracts`)}`
          })
        }).catch(() => {});
      }
    }

    if (autoApproved > 0) console.log(`[auto-approve] Released ${autoApproved} milestones`);
  } catch (err) {
    console.error('[auto-approve] Error:', err.message);
  }
}

export function initAutoApproveCron() {
  cron.schedule('0 * * * *', autoApproveMilestones);
  cron.schedule('0 2 * * *', autoCancelDormantContracts);
  console.log(`[CRON] Scheduled: Auto-approve milestones (hourly, ${AUTO_APPROVE_HOURS}h timeout) + dormant contract cancellation (daily 2 AM)`);
}

async function autoCancelDormantContracts() {
  try {
    const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000); // 72h

    const dormant = await EngagementContractModel.find({
      status: 'active',
      'duration.start': { $lt: cutoff },
      progress: { $lt: 20 }
    });

    let cancelled = 0;
    for (const contract of dormant) {
      contract.status = 'cancelled';
      contract.contractTerms = (contract.contractTerms || '') + `\n[AUTO-CANCELLED ${new Date().toISOString()}]: Promoter did not make significant progress within 72 hours.`;

      // Refund marketer
      const escrow = await EngagementEscrowModel.findById(contract.escrowId);
      if (escrow) {
        const remaining = escrow.amount - escrow.released;
        if (remaining > 0) {
          await UserModel.findByIdAndUpdate(contract.marketerId, { $inc: { 'wallets.marketer.balance': remaining } });
          escrow.status = 'refunded';
          await escrow.save();
        }
      }

      await contract.save();

      // Notify both parties
      const [marketer, promoter] = await Promise.all([
        UserModel.findById(contract.marketerId).select('email displayName').lean(),
        UserModel.findById(contract.promoterId).select('email displayName').lean()
      ]);

      await sendEmail({
        to: marketer?.email,
        subject: 'Contract auto-cancelled — ₦' + contract.payment.total + ' refunded',
        html: wrapEmail({
          title: 'Contract Cancelled',
          content: `<p>Your engagement contract with <strong>${promoter?.displayName}</strong> was cancelled because the promoter did not make significant progress within 72 hours.</p>
            <p><strong>₦${contract.payment.total}</strong> has been refunded to your wallet.</p>
            ${brandedButton('Browse Promoters', `${process.env.FRONTEND_URL}/dashboard/marketer/hire`)}`
        })
      }).catch(() => {});

      await sendEmail({
        to: promoter?.email,
        subject: 'Contract cancelled due to inactivity',
        html: wrapEmail({
          title: 'Contract Cancelled',
          content: `<p>Your contract with <strong>${marketer?.displayName}</strong> was cancelled because you didn't make significant progress within 72 hours.</p>
            <p>Keep your engagement active to avoid cancellations in the future.</p>`
        })
      }).catch(() => {});

      cancelled++;
    }

    if (cancelled > 0) console.log(`[auto-cancel] Cancelled ${cancelled} dormant contracts`);
  } catch (err) {
    console.error('[auto-cancel] Error:', err.message);
  }
}
