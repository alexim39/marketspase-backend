import { CampaignModel } from '../../models/campaign.model.js';
import cron from 'node-cron';
import mongoose from 'mongoose';

// Optional: light telemetry hook
function logResult(prefix, res) {
  const matched = res?.matched ?? res?.n ?? 0;
  const modified = res?.modified ?? res?.nModified ?? 0;
  console.log(`${prefix} matched=${matched} modified=${modified}`);
}

export const CampaignSchedulerService = {
  registerCampaignExpiryCron: function () {
    // Run once every day at midnight
    const schedule = '0 0 * * *';
    //const schedule = '*/2 * * * *';

    cron.schedule(schedule, async () => {
      const start = Date.now();
      try {
        // Ensure DB is connected (if your app connects elsewhere, you can skip this)
        if (mongoose.connection.readyState !== 1) {
          // Replace with your own connection bootstrap if needed
          // await mongoose.connect(process.env.MONGO_URL!);
        }

        const result = await CampaignModel.markExpiredCampaigns();
        logResult('[CRON] markExpiredCampaigns()', result);
      } catch (err) {
        console.error('[CRON] markExpiredCampaigns() failed:', err);
      } finally {
        const ms = Date.now() - start;
        console.log(`[CRON] markExpiredCampaigns() finished in ${ms}ms`);
      }
    }, {
      timezone: 'Africa/Lagos' // runs at your local business TZ
    });

    console.log('[CRON] Scheduled: markExpiredCampaigns()');
  },

  registerCampaignExhaustionCron: function () {
    // Run once every day at midnight
    const schedule = '0 0 * * *';
    //const schedule = '*/2 * * * *';

    cron.schedule(schedule, async () => {
      const start = Date.now();
      try {
        // Ensure DB is connected (if your app connects elsewhere, you can skip this)
        if (mongoose.connection.readyState !== 1) {
          // Replace with your own connection bootstrap if needed
          // await mongoose.connect(process.env.MONGO_URL!);
        }

        const result = await CampaignModel.markExhaustedCampaigns();
        logResult('[CRON] markExhaustedCampaigns()', result);
      } catch (err) {
        console.error('[CRON] markExhaustedCampaigns() failed:', err);
      } finally {
        const ms = Date.now() - start;
        console.log(`[CRON] markExhaustedCampaigns() finished in ${ms}ms`);
      }
    }, {
      timezone: 'Africa/Lagos' // runs at your local business TZ
    });

    console.log('[CRON] Scheduled: markExhaustedCampaigns()');
  }
};
