import { CampaignModel } from '../../models/campaign.model.js';
//import { UserModel } from '../../../user/models/user.model.js';
import cron from 'node-cron';
import mongoose from 'mongoose';
import { sendEmail } from '../../../../services/email.service.js';
import { campaignApprovedTemplate } from '../../services/email/campaignApprovedTemplate.js';
import { NotificationService } from '../../../notification/services/notification.service.js';

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
  },

  /**
   * 🚀 NEW CRON: Auto-activate pending campaigns created by marketers
   * Runs every hour to check for pending campaigns and activate them
   */
  registerAutoActivateCampaignsCron: function () {
    // Run every hour at minute 0
    const schedule = '0 * * * *';
    //const schedule = '*/2 * * * *';

    cron.schedule(schedule, async () => {
      const start = Date.now();
      const session = await mongoose.startSession();
      
      try {
        console.log('[CRON] Starting auto-activation check for pending campaigns...');
        
        // Ensure DB is connected
        if (mongoose.connection.readyState !== 1) {
          console.error('[CRON] MongoDB not connected');
          return;
        }

        session.startTransaction();

        // Find all pending campaigns that are eligible for activation
        const pendingCampaigns = await CampaignModel.find({
          status: 'pending',
          budget: { $gte: 500 }, // Minimum budget check
          startDate: { $lte: new Date() }, // Start date has arrived or is in the past
          isDeleted: false
        }).session(session);

        if (!pendingCampaigns.length) {
          console.log('[CRON] No pending campaigns to activate');
          await session.abortTransaction();
          session.endSession();
          return;
        }

        console.log(`[CRON] Found ${pendingCampaigns.length} pending campaigns to activate`);

        const activatedCampaigns = [];
        const failedCampaigns = [];

        for (const campaign of pendingCampaigns) {
          try {
            // Skip if already activated (safety check)
            if (campaign.status === 'active') {
              continue;
            }

            // Apply activation rules (similar to UpdateCampaignStatus controller)
            
            // Check if can be activated from pending state
            if (campaign.status !== 'pending') {
              failedCampaigns.push({ id: campaign._id, reason: 'Invalid status for activation' });
              continue;
            }

            // Validate budget again
            if (!campaign.budget || campaign.budget < 500) {
              failedCampaigns.push({ id: campaign._id, reason: 'Insufficient budget' });
              continue;
            }

            // Snapshot payout rules if not already set
            if (!campaign.payoutRulesSnapshot) {
              campaign.payoutRulesSnapshot = {
                model: "performance_based_views",
                tiers: [
                  { min: 35, max: 65, payout: 100 },
                  { min: 66, max: 101, payout: 200 },
                  { min: 102, max: 150, payout: 300 },
                  { min: 151, max: 310, payout: 400 },
                  { min: 311, max: null, payout: 500 }
                ],
                lockedAt: new Date()
              };
            }

            // Set activation timestamp if not set
            if (!campaign.activatedAt) {
              campaign.activatedAt = new Date();
            }

            // Update campaign status using the model method
            campaign.updateStatus('active', campaign.owner, 'Auto-activated by scheduler');
            
            await campaign.save({ session });
            activatedCampaigns.push(campaign._id);

          } catch (campaignError) {
            console.error(`[CRON] Failed to activate campaign ${campaign._id}:`, campaignError);
            failedCampaigns.push({ id: campaign._id, reason: campaignError.message });
          }
        }

        await session.commitTransaction();
        session.endSession();

        console.log(`[CRON] Auto-activation completed: ${activatedCampaigns.length} activated, ${failedCampaigns.length} failed`);

        // Send notifications for activated campaigns (outside transaction)
        if (activatedCampaigns.length > 0) {
          await this.sendActivationNotifications(activatedCampaigns);
        }

      } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('[CRON] Auto-activation cron failed:', error);
      } finally {
        const ms = Date.now() - start;
        console.log(`[CRON] Auto-activation check finished in ${ms}ms`);
      }
    }, {
      timezone: 'Africa/Lagos'
    });

    console.log('[CRON] Scheduled: Auto-activate pending campaigns (every hour)');
  },

  /**
   * Helper method to send notifications for auto-activated campaigns
   */
  async sendActivationNotifications(campaignIds) {
    try {
      const campaigns = await CampaignModel.find({
        _id: { $in: campaignIds }
      }).populate('owner');

      for (const campaign of campaigns) {
        try {
          const marketer = campaign.owner;

          if (marketer?.email) {
            // Send email notification
            const emailContent = campaignApprovedTemplate({
              userName: marketer.displayName || marketer.name || 'Valued Marketer',
              campaignTitle: campaign.title,
              campaignId: campaign._id,
              budget: campaign.budget
            });

            await sendEmail(
              marketer.email,
              "Your Campaign Is Live 🚀 - MarketSpase (Auto-Activated)",
              emailContent
            );

            // Create in-app notification
            await NotificationService.createCampaignApprovedNotification(
              campaign.owner._id,
              campaign
            );

            // Log notification in campaign
            campaign.logNotification('campaign_approved', campaign.owner._id, {
              method: 'auto-activation',
              timestamp: new Date()
            });
            
            await campaign.save();
          }
        } catch (notifyError) {
          console.error(`[CRON] Failed to send notification for campaign ${campaign._id}:`, notifyError);
        }
      }
    } catch (error) {
      console.error('[CRON] Failed to send activation notifications:', error);
    }
  },

  /**
   * Initialize all cron jobs
   */
  initializeAllCrons: function () {
    this.registerCampaignExpiryCron();
    this.registerCampaignExhaustionCron();
    this.registerAutoActivateCampaignsCron();
    console.log('[CRON] All campaign scheduler jobs initialized');
  }
};