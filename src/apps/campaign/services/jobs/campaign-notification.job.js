
// src/apps/campaign/services/jobs/campaign-notification.job.js
import { CampaignModel } from '../../models/index.js';
import { UserModel } from '../../../user/models/user/index.js';
import { NotificationModel } from '../../../notification/models/index.js';
import { sendEmail } from '../../../../core/email.service.js';
import { newCampaignEmailTemplate } from '../email/newCampaignTemplate.js';

const DAILY_LIMIT = 4;   // per user per day
const BATCH_SIZE  = 500; // users per run

export const campaignAvailabilityNotification = async () => {
  try {
    console.log('🧹 Starting campaign availability notification job...');

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // 1) Campaigns created in last 24h and active
    const campaigns = await CampaignModel.find({
      status: 'active',
      createdAt: { $gte: since },
    }).lean();

    if (!campaigns.length) return;

    // 2) Promoters who opted in
    const promoters = await UserModel.find({
      role: 'promoter',
      isActive: true,
      'preferences.notification': { $ne: false },
    })
      .select('email displayName')
      .limit(BATCH_SIZE)
      .lean();

    for (const promoter of promoters) {
      // 3) Enforce DAILY_LIMIT per user (only for this notification type/channel)
      const startOfDay = new Date(new Date().setHours(0, 0, 0, 0));
      const sentToday = await NotificationModel.countDocuments({
        userId: promoter._id,
        type: 'campaign_availability',
        channel: 'email',
        sentAt: { $gte: startOfDay },
      });

      if (sentToday >= DAILY_LIMIT) continue;

      // 4) Filter out campaigns already notified to this user
      const already = await NotificationModel.find({
        userId: promoter._id,
        type: 'campaign_availability',
        channel: 'email',
        campaignId: { $in: campaigns.map(c => c._id) },
      }).select('campaignId').lean();

      const alreadySet = new Set(already.map(n => String(n.campaignId)));
      const newOnes = campaigns.filter(c => !alreadySet.has(String(c._id)));

      if (!newOnes.length) continue;

      // 5) Compose email
      const count = newOnes.length;
      const subject = 'New Campaigns Available';
      const html = newCampaignEmailTemplate(promoter, count);

      // 6) Try sending email; only log on success
      try {
        await sendEmail(promoter.email, subject, html);
        console.log(`📧 Sent campaign availability email to ${promoter.email} for ${count} new campaign(s).`);

        const now = new Date();
        const title = subject;
        const message =
          count === 1
            ? '1 new campaign is available for you to promote.'
            : `${count} new campaigns are available for you to promote.`;

        // 7) Persist notification entries with REQUIRED fields
        const docs = newOnes.map(c => ({
          userId: promoter._id,
          campaignId: c._id,
          type: 'campaign_availability', // required
          channel: 'email',              // if your schema has it
          title,                         // required
          message,                       // required
          recipient: promoter.email,     // required (based on your error)
          sentAt: now,
          createdAt: now,                // include if your schema uses timestamps but not auto
        }));

        await NotificationModel.insertMany(docs, { ordered: false });
      } catch (mailErr) {
        // If email failed, do not insert notification logs
        console.error(`Error sending email to ${promoter.email}:`, mailErr);
      }
    }
  } catch (err) {
    console.error('Error in campaign notification cron:', err);
  }
};
