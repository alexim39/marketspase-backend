import cron from 'node-cron';
import { CampaignModel } from '../../models/campaign.model.js';
import { CampaignClickModel } from '../../models/campaign-click.model.js';
import { UserModel } from '../../../user/models/user/index.js';
import { NotificationService } from '../../../notification/services/notification.service.js';

async function analyzeAndCoach() {
  try {
    const campaigns = await CampaignModel.find({ status: 'active', isDeleted: false })
      .select('title owner category budget spentBudget costPerClick totalClicks billableClicks').lean();
    if (!campaigns.length) return;

    const insights = [];

    for (const campaign of campaigns) {
      const budgetUtil = campaign.budget > 0 ? (campaign.spentBudget / campaign.budget) * 100 : 0;
      const totalClicks = campaign.totalClicks || 0;
      const avgCtr = 1.8; // platform average

      // Check 1: Budget nearly exhausted
      if (budgetUtil >= 90 && budgetUtil < 100) {
        insights.push({
          campaignId: campaign._id, ownerId: campaign.owner,
          title: 'Budget Almost Gone',
          message: `"${campaign.title}" has ${Math.round(100 - budgetUtil)}% budget left (₦${((campaign.budget - campaign.spentBudget) / 100).toFixed(0)}k). Consider topping up to keep it running.`,
          action: 'top_up',
        });
      }

      // Check 2: Budget exhausted
      if (budgetUtil >= 100) {
        insights.push({
          campaignId: campaign._id, ownerId: campaign.owner,
          title: 'Campaign Exhausted',
          message: `"${campaign.title}" has spent its full budget. Top up to reactivate.`,
          action: 'top_up',
        });
      }

      // Check 3: Very high budget utilization in short time (risk of burning through too fast)
      if (budgetUtil > 50 && totalClicks < 20) {
        insights.push({
          campaignId: campaign._id, ownerId: campaign.owner,
          title: 'High Burn Rate',
          message: `"${campaign.title}" has used ${Math.round(budgetUtil)}% of budget with only ${totalClicks} clicks. Check your CPC and targeting.`,
          action: 'review',
        });
      } else if (totalClicks >= 20 && budgetUtil < 100) {
        const billable = campaign.billableClicks || 0;
        const ctr = totalClicks > 0 ? (billable / totalClicks) * 100 : 0;
        const createdAgo = campaign.createdAt ? (Date.now() - new Date(campaign.createdAt).getTime()) / 3600000 : 0;
        if (ctr < 0.5 && createdAgo > 48) {
          await CampaignModel.updateOne({ _id: campaign._id, status: 'active' }, { $set: { status: 'paused' } }).catch(() => {});
          insights.push({
            campaignId: campaign._id, ownerId: campaign.owner,
            title: 'Campaign Auto-Paused',
            message: `"${campaign.title}" was paused — CTR dropped below 0.5% after 48 hours (${ctr.toFixed(1)}%). Review and resume.`,
            action: 'review',
          });
        }
      }
    }

    // Send notifications
    for (const insight of insights) {
      try {
        await NotificationService.createNotification({
          recipient: insight.ownerId,
          type: 'campaign_coach',
          title: `Campaign: ${insight.title}`,
          message: insight.message,
          data: { campaignId: insight.campaignId.toString(), action: insight.action },
        }).catch(() => {});
      } catch (e) { /* skip failed notification */ }
    }

    if (insights.length) {
      console.log(`[Coach] Generated ${insights.length} insights for ${campaigns.length} campaigns`);
    }
  } catch (e) {
    console.error('[Coach] Analysis error:', e.message);
  }
}

export function initCampaignPerformanceCoach() {
  cron.schedule('0 */6 * * *', analyzeAndCoach);
  console.log('[CRON] Scheduled: AI Campaign Performance Coach (every 6 hours)');
}
