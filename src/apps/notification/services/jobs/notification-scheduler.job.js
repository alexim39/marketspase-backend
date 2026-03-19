// services/notification-scheduler.js
import cron from "node-cron";
import { PromotionModel } from "../../../promotion/models/index.js";
import { CampaignModel } from "../../../campaign/models/index.js";
import { UserModel } from "../../../user/models/user/index.js";
import { NotificationService } from "../notification.service.js";
import { NotificationModel } from "../../models/index.js";
// import { sendEmail } from "../../../../services/email.service.js";
// import { promotionExpiringTemplate } from "../../../promotion/services/email/promotionExpiringTemplate.js";
import { promotionAutoRejection } from "../../services/promotion-auto-reject.service.js";
import { promotionSubmissionReminder } from "../../services/promotion-submission-reminder.service.js";
import { userBirthdayService } from '../user-birthday.service.js';
import { activityLogCleaner } from './activity-log-cleaner.job.js'
import { campaignAvailabilityNotification } from '../../../campaign/services/jobs/campaign-notification.job.js'; // do not remove this import as it will be needed for the job to run when resources are upgraded later
import { promotionAutoPayService } from "../../services/promotion-auto-pay.service.js";


// 1. 20-HOUR SUBMISSION REMINDER - Every hour
cron.schedule("0 * * * *", promotionSubmissionReminder, { timezone: "Africa/Lagos" })
//cron.schedule('*/2 * * * *', promotionSubmissionReminder)

// 2. BUDGET ALERTS - Every hour
cron.schedule("0 * * * *", async () => {
  //cron.schedule('*/2 * * * *', async () => {
  try {
    console.log("Running budget monitoring job...");

    // Find campaigns that need budget alerts
    const budgetAlertCampaigns =
      await CampaignModel.findCampaignsNeedingBudgetAlerts(80);

    console.log(
      `Found ${budgetAlertCampaigns.length} campaigns needing budget alerts`
    );

    for (const campaign of budgetAlertCampaigns) {
      try {
        // Get marketer's current wallet balance
        const marketer = await UserModel.findById(campaign.owner);

        await NotificationService.createLowBalanceNotification(
          campaign.owner._id,
          marketer.wallets.marketer.balance,
          campaign
        );

        await campaign.recordBudgetAlert(80);
        await campaign.logNotification("low_balance", campaign.owner._id, {
          utilization: campaign.budgetUtilization,
          threshold: 80,
        });

        console.log(`Budget alert sent for campaign: ${campaign.title}`);
      } catch (error) {
        console.error(
          `Error sending budget alert for campaign ${campaign._id}:`,
          error
        );
      }
    }
  } catch (error) {
    console.error("Error in budget monitoring job:", error);
  }
});

// 3. DEADLINE REMINDERS - 8 AM daily
cron.schedule("0 8 * * *", async () => {
  //cron.schedule('*/2 * * * *', async () => {
  try {
    console.log("Running deadline reminder job...");

    // Find campaigns approaching deadline (within 3 days)
    const deadlineCampaigns =
      await CampaignModel.findCampaignsApproachingDeadline(3);

    console.log(
      `Found ${deadlineCampaigns.length} campaigns approaching deadline`
    );

    for (const campaign of deadlineCampaigns) {
      try {
        const daysRemaining = campaign.remainingDays;

        // Notify campaign owner
        await NotificationService.createNotification({
          recipient: campaign.owner._id,
          type: "deadline_reminder",
          title: "Campaign Deadline Approaching",
          message: `Your campaign "${campaign.title}" ends in ${daysRemaining} day(s).`,
          data: {
            campaignId: campaign._id,
            daysRemaining: daysRemaining,
            actionUrl: `/campaigns/${campaign._id}`,
          },
          priority: "medium",
        });

        await campaign.logNotification(
          "deadline_reminder",
          campaign.owner._id,
          {
            daysRemaining: daysRemaining,
          }
        );

        console.log(`Deadline reminder sent for campaign: ${campaign.title}`);
      } catch (error) {
        console.error(
          `Error sending deadline reminder for campaign ${campaign._id}:`,
          error
        );
      }
    }
  } catch (error) {
    console.error("Error in deadline reminder job:", error);
  }
});

// 4. WEEKLY PERFORMANCE SUMMARY - Monday 9 AM
cron.schedule("0 9 * * 1", async () => {
  //cron.schedule('*/2 * * * *', async () => {
  try {
    console.log("Running weekly performance summary job...");

    // Get date range for last week
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Send weekly earnings summary to promoters
    const promoters = await UserModel.find({
      role: "promoter",
      isActive: true,
      isDeleted: false,
    });

    let promoterNotificationsSent = 0;
    let marketerNotificationsSent = 0;

    for (const promoter of promoters) {
      try {
        // Calculate weekly earnings from completed promotions
        const weeklyPromotions = await PromotionModel.find({
          promoter: promoter._id,
          status: "completed",
          completedAt: {
            $gte: startDate,
            $lte: endDate,
          },
        }).populate("campaign");

        const weeklyEarnings = weeklyPromotions.reduce((total, promotion) => {
          return total + (promotion.payoutAmount || 0);
        }, 0);

        const completedCount = weeklyPromotions.length;

        if (completedCount > 0) {
          await NotificationService.createNotification({
            recipient: promoter._id,
            type: "weekly_summary",
            title: "Weekly Earnings Summary",
            message: `You completed ${completedCount} promotion(s) and earned ₦${weeklyEarnings} this week.`,
            data: {
              earnings: weeklyEarnings,
              completedPromotions: completedCount,
              period: "last_week",
              actionUrl: "/analytics/earnings",
            },
            priority: "low",
          });
          promoterNotificationsSent++;
        }
      } catch (error) {
        console.error(
          `Error sending weekly summary to promoter ${promoter._id}:`,
          error
        );
      }
    }

    // Send campaign performance summary to marketers
    const marketers = await UserModel.find({
      role: "marketer",
      isActive: true,
      isDeleted: false,
    });

    for (const marketer of marketers) {
      try {
        // Get active campaigns in the last week
        const weeklyCampaigns = await CampaignModel.find({
          owner: marketer._id,
          $or: [
            { createdAt: { $gte: startDate, $lte: endDate } },
            { updatedAt: { $gte: startDate, $lte: endDate } },
          ],
        });

        // Get campaign performance metrics
        const activeCampaigns = weeklyCampaigns.filter(
          (c) => c.status === "active"
        ).length;
        const completedCampaigns = weeklyCampaigns.filter(
          (c) => c.status === "completed"
        ).length;
        const totalSpent = weeklyCampaigns.reduce(
          (total, campaign) => total + campaign.spentBudget,
          0
        );

        if (weeklyCampaigns.length > 0) {
          await NotificationService.createNotification({
            recipient: marketer._id,
            type: "weekly_summary",
            title: "Weekly Campaign Performance",
            message: `You had ${activeCampaigns} active and ${completedCampaigns} completed campaigns this week. Total spent: ₦${totalSpent}`,
            data: {
              activeCampaigns,
              completedCampaigns,
              totalSpent,
              totalCampaigns: weeklyCampaigns.length,
              period: "last_week",
              actionUrl: "/analytics/campaigns",
            },
            priority: "low",
          });
          marketerNotificationsSent++;
        }
      } catch (error) {
        console.error(
          `Error sending weekly summary to marketer ${marketer._id}:`,
          error
        );
      }
    }

    console.log(
      `Weekly summaries sent: ${promoterNotificationsSent} to promoters, ${marketerNotificationsSent} to marketers`
    );
  } catch (error) {
    console.error("Error in weekly performance summary job:", error);
  }
});

// 5. LOW BALANCE MONITORING - Every 6 hours
cron.schedule("0 */6 * * *", async () => {
  //cron.schedule('*/2 * * * *', async () => {
  try {
    console.log("Running low balance monitoring job...");

    // Find marketers with low wallet balance
    const marketers = await UserModel.find({
      role: "marketer",
      isActive: true,
      isDeleted: false,
      "wallets.marketer.balance": { $lt: 5000 },
    });

    let lowBalanceNotificationsSent = 0;

    for (const marketer of marketers) {
      try {
        // Check if user has active campaigns that could be affected
        const activeCampaigns = await CampaignModel.find({
          owner: marketer._id,
          status: "active",
        });

        if (activeCampaigns.length > 0) {
          // Check if we haven't sent a low balance notification recently
          const recentNotification = await CampaignModel.findOne({
            owner: marketer._id,
            "notificationLog.type": "low_balance",
            "notificationLog.sentAt": {
              $gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
            },
          });

          if (!recentNotification) {
            await NotificationService.createLowBalanceNotification(
              marketer._id,
              marketer.wallets.marketer.balance,
              activeCampaigns[0]
            );
            lowBalanceNotificationsSent++;

            // Log the notification in one of the active campaigns
            if (activeCampaigns[0]) {
              await activeCampaigns[0].logNotification(
                "low_balance",
                marketer._id,
                {
                  currentBalance: marketer.wallets.marketer.balance,
                  threshold: 5000,
                }
              );
            }
          }
        }
      } catch (error) {
        console.error(
          `Error sending low balance notification to marketer ${marketer._id}:`,
          error
        );
      }
    }

    console.log(
      `Low balance notifications sent: ${lowBalanceNotificationsSent}`
    );
  } catch (error) {
    console.error("Error in low balance monitoring job:", error);
  }
});

// 6. NOTIFICATION CLEANUP - 2 AM daily
cron.schedule("0 2 * * *", async () => {
  //cron.schedule('*/2 * * * *', async () => {
  const jobStartTime = new Date();
  console.log(
    `🔄 [${jobStartTime.toISOString()}] Starting notification cleanup job...`
  );

  try {
    const retentionDays = 7;
    const batchSize = 1000;

    const countBefore = await NotificationModel.countOldReadNotifications(
      retentionDays
    );
    console.log(
      `📊 Found ${countBefore} read/dismissed notifications older than ${retentionDays} days`
    );

    if (countBefore === 0) {
      console.log("✅ No old notifications to clean up");
      return;
    }

    let totalDeleted = 0;

    if (countBefore > batchSize) {
      console.log(
        `🔄 Large dataset detected (${countBefore} items), processing in batches...`
      );

      let batchNumber = 1;
      let remaining = countBefore;

      while (remaining > 0) {
        const cutoffDate = new Date(
          Date.now() - retentionDays * 24 * 60 * 60 * 1000
        );

        const result = await NotificationModel.deleteMany({
          status: { $in: ["read", "dismissed"] },
          $or: [
            { readAt: { $lt: cutoffDate } },
            {
              status: { $in: ["read", "dismissed"] },
              readAt: { $exists: false },
              createdAt: { $lt: cutoffDate },
            },
          ],
        }).limit(batchSize);

        totalDeleted += result.deletedCount;
        remaining = await NotificationModel.countOldReadNotifications(
          retentionDays
        );

        console.log(
          `📦 Batch ${batchNumber}: Deleted ${result.deletedCount} notifications (${remaining} remaining)`
        );
        batchNumber++;

        if (remaining > 0) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
    } else {
      const result = await NotificationModel.cleanupOldReadNotifications(
        retentionDays
      );
      totalDeleted = result.deletedCount;
    }

    const jobEndTime = new Date();
    const duration = (jobEndTime - jobStartTime) / 1000;

    console.log(`✅ Notification cleanup completed:
    - Deleted: ${totalDeleted} notifications
    - Duration: ${duration.toFixed(2)} seconds
    - Finished at: ${jobEndTime.toISOString()}`);
  } catch (error) {
    const jobEndTime = new Date();
    const duration = (jobEndTime - jobStartTime) / 1000;

    console.error(
      `❌ Notification cleanup job failed after ${duration.toFixed(
        2
      )} seconds:`,
      error
    );
  }
});

// 7. AUTO-REJECT EXPIRED PROMOTIONS (24 hours) — 100% aligned with new financial flow
cron.schedule("0 */5 * * *", promotionAutoRejection);
//cron.schedule('*/2 * * * *', promotionAutoRejection)

// 8. AUTO BIRTHDAY NOTIFICATIONS - 9 AM daily
cron.schedule("0 9 * * *", userBirthdayService, { timezone: "Africa/Lagos" });
//cron.schedule('*/2 * * * *', userBirthdayService)

// 9. Promoter Campaign Availability Notification
//cron.schedule('*/25 * * * *', campaignAvailabilityNotification)  // every 25 min - to be enabled later in the feature when email sending size is increased.
//cron.schedule('*/2 * * * *', campaignAvailabilityNotification)

// 10. ACTIVITY LOG CLEANUP - 3 AM daily
cron.schedule("0 3 * * *", activityLogCleaner);
// cron.schedule("0 3 */14 * *", activityLogCleaner);
//cron.schedule('*/2 * * * *', activityLogCleaner)

// 11. AUTO-PAY VALIDATED PROMOTIONS - Every hour
cron.schedule("0 * * * *", promotionAutoPayService, { timezone: "Africa/Lagos" })
//cron.schedule('*/2 * * * *', promotionAutoPayService)

/* For Admin */

// Validation reminder for submitted promotions (Daily at 10 AM)
/* cron.schedule('0 10 * * *', async () => {
  try {
    console.log('Running admin validation reminder job...');
    
    // Find submitted promotions that haven't been validated for 3+ days
    const pendingValidations = await PromotionModel.findPromotionsNeedingValidationReminders(3);

    console.log(`Found ${pendingValidations.length} promotions needing validation reminders`);

    let validationRemindersSent = 0;

    for (const promotion of pendingValidations) {
      try {
        const campaign = await CampaignModel.findById(promotion.campaign).populate('owner');
        
        if (campaign && campaign.owner) {
          // Notify campaign owner about pending validation
          await NotificationService.createNotification({
            recipient: campaign.owner._id,
            type: 'validation_reminder',
            title: 'Pending Promotion Validation',
            message: `Promotion for "${campaign.title}" has been submitted for ${promotion.daysSinceSubmission} days and needs validation.`,
            data: {
              campaignId: campaign._id,
              promotionId: promotion._id,
              daysSinceSubmission: promotion.daysSinceSubmission,
              actionUrl: `/campaigns/${campaign._id}/promotions`
            },
            priority: 'medium'
          });

          await promotion.recordValidationReminder();
          await promotion.logNotification('validation_reminder', campaign.owner._id, {
            daysSinceSubmission: promotion.daysSinceSubmission
          });

          validationRemindersSent++;
          console.log(`Validation reminder sent for promotion ${promotion._id} to campaign owner ${campaign.owner._id}`);
        }
      } catch (error) {
        console.error(`Error sending validation reminder for promotion ${promotion._id}:`, error);
      }
    }

    console.log(`Validation reminder job completed: ${validationRemindersSent} reminders sent`);

  } catch (error) {
    console.error('Error in validation reminder job:', error);
  }
}); */

console.log("Notification scheduler started successfully");
export default cron;
