import cron from 'node-cron';
import { CampaignModel } from '../../models/campaign.model.js';
import { UserModel } from '../../../user/models/user/index.js';
import { sendEmail } from '../../../../core/email.service.js';
import { wrapEmail, brandedButton } from '../../../../core/brand-email.js';

async function sendWeeklyDigest() {
  try {
    const campaigns = await CampaignModel.find({ status: 'active', isDeleted: false })
      .select('title owner spentBudget budget totalClicks billableClicks costPerClick category').lean();
    if (!campaigns.length) return;

    // Group by owner
    const byOwner = {};
    for (const c of campaigns) {
      const key = String(c.owner);
      if (!byOwner[key]) byOwner[key] = { ownerId: key, campaigns: [] };
      byOwner[key].campaigns.push(c);
    }

    for (const entry of Object.values(byOwner)) {
      try {
        const user = await UserModel.findById(entry.ownerId).select('email displayName').lean();
        if (!user?.email) continue;

        const rows = entry.campaigns.map(c => {
          const budgetUtil = c.budget > 0 ? Math.round((c.spentBudget / c.budget) * 100) : 0;
          return `<tr>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;"><strong>${c.title}</strong><br><span style="font-size:12px;color:#888">${c.category}</span></td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center;">${c.totalClicks || 0}</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">₦${((c.spentBudget || 0) / 1000).toFixed(1)}k / ₦${((c.budget || 0) / 1000).toFixed(1)}k</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${budgetUtil}%</td>
          </tr>`;
        }).join('');

        const frontendUrl = process.env.FRONTEND_URL || 'https://marketspase.com';
        const content = `
          <p style="font-size:15px;line-height:1.6">Hi ${user.displayName || 'there'},</p>
          <p>Here's your weekly campaign performance summary:</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
            <thead><tr style="background:rgba(103,58,183,0.05);">
              <th style="padding:8px;text-align:left;">Campaign</th>
              <th style="padding:8px;text-align:center;">Clicks</th>
              <th style="padding:8px;text-align:right;">Budget</th>
              <th style="padding:8px;text-align:right;">Used</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
          ${brandedButton('View Campaigns', `${frontendUrl}/dashboard/campaigns`)}
          <p style="font-size:12px;color:#999;margin-top:16px">You're receiving this because you have active campaigns on MarketSpase. Unsubscribe in your notification settings.</p>
        `;
        sendEmail(user.email, 'Weekly Campaign Performance Digest', wrapEmail({ title: 'Campaign Performance', content, withFooter: true })).catch(() => {});
      } catch (e) { /* skip failed */ }
    }
  } catch (e) { console.error('[Digest] Error:', e.message); }
}

export function initCampaignDigestCron() {
  cron.schedule('0 9 * * 1', sendWeeklyDigest);
  console.log('[CRON] Scheduled: Weekly campaign performance digest (Mon 9 AM)');
}
