// jobs/campaignNotification.job.js
import cron from 'node-cron';
import { CampaignModel } from '../../models/campaign.model.js';
import { UserModel } from '../../../user/models/user.model.js';
import { NotificationModel } from '../../../notification/models/notification.model.js';
import { sendEmail } from '../../../../services/emailService.js';
import { newCampaignEmailTemplate } from '../email/newCampaignTemplate.js';

const DAILY_LIMIT = 4; // per user per day
const BATCH_SIZE = 500; // emails per run

cron.schedule('*/5 * * * *', async () => {   // every 5 min
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const campaigns = await CampaignModel.find({
      status: 'approved',
      createdAt: { $gte: since }
    }).lean();

    if (!campaigns.length) return;

    const promoters = await UserModel.find({
      role: 'promoter',
      isActive: true,
      'preferences.notification': { $ne: false }
    })
      .select('email displayName')
      .limit(BATCH_SIZE)
      .lean();

    for (const promoter of promoters) {
      const sentToday = await NotificationModel.countDocuments({
        userId: promoter._id,
        sentAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
      });

      if (sentToday >= DAILY_LIMIT) continue;

      // campaigns not yet notified to this user
      const already = await NotificationModel.find({
        userId: promoter._id,
        campaignId: { $in: campaigns.map(c => c._id) }
      }).lean();

      const newOnes = campaigns.filter(
        c => !already.some(n => String(n.campaignId) === String(c._id))
      );
      if (!newOnes.length) continue;

      const html = newCampaignEmailTemplate(promoter, newOnes.length);
      await sendEmail(promoter.email, 'New Campaigns Available', html);

      // record sent notifications
      const docs = newOnes.map(c => ({
        userId: promoter._id,
        campaignId: c._id,
        sentAt: new Date()
      }));
      await NotificationModel.insertMany(docs);
    }
  } catch (err) {
    console.error('Error in campaign notification cron:', err);
  }
});
