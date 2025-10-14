// services/notification-scheduler.js
import cron from 'node-cron';
import { PromotionModel } from '../../../promotion/models/promotion.model.js';
import { CampaignModel } from '../../../campaign/models/campaign.model.js';
import { UserModel } from '../../../user/models/user.model.js';
import { NotificationService } from '../notification.service.js';
import { NotificationModel } from '../../models/notification.model.js';

// Daily reminder for pending submissions (9 AM and 6 PM)
//cron.schedule('*/1 * * * *', async () => {
cron.schedule('0 9,18 * * *', async () => {
  try {
    console.log('Running submission reminder job...');
    
    // Use the new static method to find promotions needing reminders
    const pendingPromotions = await PromotionModel.findPromotionsNeedingSubmissionReminders();

    console.log(`Found ${pendingPromotions.length} promotions needing submission reminders`);

    let remindersSent = 0;

    for (const promotion of pendingPromotions) {
      try {
        // Use the instance method to check if reminder should be sent
        if (promotion.shouldSendSubmissionReminder()) {
          const campaign = await CampaignModel.findById(promotion.campaign);
          const daysRemaining = campaign ? campaign.remainingDays : 7;
          
          await NotificationService.createSubmissionReminder(
            promotion.promoter._id,
            campaign,
            promotion,
            daysRemaining
          );
          
          // Use the new record method that handles all tracking
          await promotion.recordSubmissionReminder();
          remindersSent++;
          
          console.log(`Submission reminder sent for promotion ${promotion._id} to promoter ${promotion.promoter._id}`);
        }
      } catch (error) {
        console.error(`Error sending reminder for promotion ${promotion._id}:`, error);
      }
    }

    console.log(`Submission reminder job completed: ${remindersSent} reminders sent`);

  } catch (error) {
    console.error('Error in submission reminder job:', error);
  }
});

// Budget monitoring job (runs every hour)
/* cron.schedule('0 * * * *', async () => {
  try {
    console.log('Running budget monitoring job...');
    
    // Find campaigns with exhausted budget
    const exhaustedCampaigns = await CampaignModel.find({
      status: 'active',
      $expr: { $gte: ['$spentAmount', '$budget'] }
    }).populate('owner');

    for (const campaign of exhaustedCampaigns) {
      try {
        await NotificationService.createBudgetExhaustedNotification(
          campaign.owner._id,
          campaign
        );

        // Pause the campaign
        await CampaignModel.findByIdAndUpdate(campaign._id, {
          status: 'paused',
          pauseReason: 'budget_exhausted'
        });

      } catch (error) {
        console.error(`Error processing budget exhaustion for campaign ${campaign._id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in budget monitoring job:', error);
  }
}); */

// Weekly performance summary (Monday 9 AM)
//cron.schedule('*/1 * * * *', async () => {
cron.schedule('0 9 * * 1', async () => {
  try {
    console.log('Running weekly performance summary job...');
    
    // Get date range for last week
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Send weekly earnings summary to promoters
    const promoters = await UserModel.find({ role: 'promoter' });
    
    for (const promoter of promoters) {
      try {
        // Calculate weekly earnings
        const weeklyPromotions = await PromotionModel.find({
          promoter: promoter._id,
          status: 'completed',
          completedAt: { $gte: startDate, $lte: endDate }
        });

        const weeklyEarnings = weeklyPromotions.reduce((total, promotion) => {
          return total + (promotion.payoutAmount || 0);
        }, 0);

        const completedCount = weeklyPromotions.length;

        if (completedCount > 0) {
          await NotificationService.createPayoutReadyNotification(
            promoter._id,
            weeklyEarnings,
            completedCount
          );
        }

      } catch (error) {
        console.error(`Error sending weekly summary to promoter ${promoter._id}:`, error);
      }
    }

    // Send campaign performance to marketers
    const marketers = await UserModel.find({ role: 'marketer' });
    
    for (const marketer of marketers) {
      try {
        const weeklyCampaigns = await CampaignModel.find({
          owner: marketer._id,
          createdAt: { $gte: startDate, $lte: endDate }
        });

        if (weeklyCampaigns.length > 0) {
          await NotificationService.createNotification({
            recipient: marketer._id,
            type: 'weekly_summary',
            title: 'Weekly Campaign Summary',
            message: `You had ${weeklyCampaigns.length} campaign(s) active this week. Check your dashboard for detailed analytics.`,
            data: {
              campaignsCount: weeklyCampaigns.length,
              actionUrl: '/analytics'
            },
            priority: 'low'
          });
        }

      } catch (error) {
        console.error(`Error sending weekly summary to marketer ${marketer._id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in weekly performance summary job:', error);
  }
});

// Low balance monitoring (runs every 6 hours)
//cron.schedule('*/1 * * * *', async () => {
cron.schedule('0 */6 * * *', async () => {
  try {
    console.log('Running low balance monitoring job...');
    
    const marketers = await UserModel.find({ 
      role: 'marketer',
      walletBalance: { $lt: 5000 } // Threshold: ₦5000
    });

    for (const marketer of marketers) {
      try {
        const activeCampaigns = await CampaignModel.find({
          owner: marketer._id,
          status: 'active'
        });

        if (activeCampaigns.length > 0) {
          await NotificationService.createLowBalanceNotification(
            marketer._id,
            marketer.walletBalance,
            activeCampaigns[0] // Send first active campaign as reference
          );
        }

      } catch (error) {
        console.error(`Error sending low balance notification to marketer ${marketer._id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in low balance monitoring job:', error);
  }
});


// 1. Budget Alerts - Every hour
//cron.schedule('*/1 * * * *', async () => {
cron.schedule('0 * * * *', async () => {
  // Budget alert implementation above
  try {
    console.log('Running budget monitoring job...');
    
    // Find campaigns that need budget alerts
    const budgetAlertCampaigns = await CampaignModel.findCampaignsNeedingBudgetAlerts(80);
    
    console.log(`Found ${budgetAlertCampaigns.length} campaigns needing budget alerts`);

    for (const campaign of budgetAlertCampaigns) {
      try {
        // Get marketer's current wallet balance
        const marketer = await UserModel.findById(campaign.owner);
        
        await NotificationService.createLowBalanceNotification(
          campaign.owner._id,
          marketer.wallets.marketer.balance, // Use marketer wallet balance
          campaign
        );
        
        await campaign.recordBudgetAlert(80);
        await campaign.logNotification('low_balance', campaign.owner._id, {
          utilization: campaign.budgetUtilization,
          threshold: 80
        });

        console.log(`Budget alert sent for campaign: ${campaign.title}`);

      } catch (error) {
        console.error(`Error sending budget alert for campaign ${campaign._id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in budget monitoring job:', error);
  }
});

// 2. Submission Reminders - 9 AM & 6 PM daily
//cron.schedule('*/1 * * * *', async () => {
cron.schedule('0 9,18 * * *', async () => {
  // Submission reminder implementation above
   try {
    console.log('Running submission reminder job...');
    
    // Find campaigns that need submission reminders
    const reminderCampaigns = await CampaignModel.findCampaignsWithPendingSubmissions();
    
    console.log(`Found ${reminderCampaigns.length} campaigns needing submission reminders`);

    for (const campaign of reminderCampaigns) {
      try {
        // Check if this campaign should send submission reminders
        if (campaign.shouldSendSubmissionReminder()) {
          
          // Find promotions that need reminders for this campaign
          const pendingPromotions = await PromotionModel.find({
            campaign: campaign._id,
            //status: 'assigned',
            status: 'pending',
            createdAt: { $lt: new Date(Date.now() - 12 * 60 * 60 * 1000) },
            submissionReminderSent: { $ne: true }
          }).populate('promoter');

          for (const promotion of pendingPromotions) {
            const deadline = campaign.endDate;
            const now = new Date();
            const timeDiff = deadline ? deadline.getTime() - now.getTime() : 0;
            const daysRemaining = deadline ? Math.ceil(timeDiff / (1000 * 60 * 60 * 24)) : 7;

            await NotificationService.createSubmissionReminder(
              promotion.promoter._id,
              campaign,
              promotion,
              daysRemaining
            );

            // Mark promotion as reminder sent
            await PromotionModel.findByIdAndUpdate(promotion._id, {
              submissionReminderSent: true
            });
          }

          await campaign.recordSubmissionReminder();
          await campaign.logNotification('submission_reminder', campaign.owner._id, {
            remindersSent: pendingPromotions.length
          });

          console.log(`Submission reminders sent for campaign: ${campaign.title}`);
        }

      } catch (error) {
        console.error(`Error sending submission reminders for campaign ${campaign._id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in submission reminder job:', error);
  }
});

// 3. Deadline Reminders - 8 AM daily
//cron.schedule('*/1 * * * *', async () => {
cron.schedule('0 8 * * *', async () => {
  // Deadline reminder implementation above
  try {
    console.log('Running deadline reminder job...');
    
    // Find campaigns approaching deadline (within 3 days)
    const deadlineCampaigns = await CampaignModel.findCampaignsApproachingDeadline(3);
    
    console.log(`Found ${deadlineCampaigns.length} campaigns approaching deadline`);

    for (const campaign of deadlineCampaigns) {
      try {
        const daysRemaining = campaign.remainingDays;
        
        // Notify campaign owner
        await NotificationService.createNotification({
          recipient: campaign.owner._id,
          type: 'deadline_reminder',
          title: 'Campaign Deadline Approaching',
          message: `Your campaign "${campaign.title}" ends in ${daysRemaining} day(s).`,
          data: {
            campaignId: campaign._id,
            daysRemaining: daysRemaining,
            actionUrl: `/campaigns/${campaign._id}`
          },
          priority: 'medium'
        });

        await campaign.logNotification('deadline_reminder', campaign.owner._id, {
          daysRemaining: daysRemaining
        });

        console.log(`Deadline reminder sent for campaign: ${campaign.title}`);

      } catch (error) {
        console.error(`Error sending deadline reminder for campaign ${campaign._id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in deadline reminder job:', error);
  }
});

// 4. Weekly Summary - Monday 9 AM
//cron.schedule('*/1 * * * *', async () => {
cron.schedule('0 9 * * 1', async () => {
  // Existing weekly summary code
    try {
    console.log('Running weekly performance summary job...');
    
    // Get date range for last week
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Send weekly earnings summary to promoters
    const promoters = await UserModel.find({ 
      role: 'promoter',
      isActive: true,
      isDeleted: false 
    });
    
    let promoterNotificationsSent = 0;
    let marketerNotificationsSent = 0;

    for (const promoter of promoters) {
      try {
        // Calculate weekly earnings from completed promotions
        const weeklyPromotions = await PromotionModel.find({
          promoter: promoter._id,
          status: 'completed',
          completedAt: { 
            $gte: startDate, 
            $lte: endDate 
          }
        }).populate('campaign');

        const weeklyEarnings = weeklyPromotions.reduce((total, promotion) => {
          return total + (promotion.payoutAmount || 0);
        }, 0);

        const completedCount = weeklyPromotions.length;

        if (completedCount > 0) {
          // Create custom weekly summary notification for promoters
          await NotificationService.createNotification({
            recipient: promoter._id,
            type: 'weekly_summary',
            title: 'Weekly Earnings Summary',
            message: `You completed ${completedCount} promotion(s) and earned ₦${weeklyEarnings} this week.`,
            data: {
              earnings: weeklyEarnings,
              completedPromotions: completedCount,
              period: 'last_week',
              actionUrl: '/analytics/earnings'
            },
            priority: 'low'
          });
          promoterNotificationsSent++;
        }

      } catch (error) {
        console.error(`Error sending weekly summary to promoter ${promoter._id}:`, error);
      }
    }

    // Send campaign performance summary to marketers
    const marketers = await UserModel.find({ 
      role: 'marketer',
      isActive: true,
      isDeleted: false 
    });
    
    for (const marketer of marketers) {
      try {
        // Get active campaigns in the last week
        const weeklyCampaigns = await CampaignModel.find({
          owner: marketer._id,
          $or: [
            { createdAt: { $gte: startDate, $lte: endDate } },
            { updatedAt: { $gte: startDate, $lte: endDate } }
          ]
        });

        // Get campaign performance metrics
        const activeCampaigns = weeklyCampaigns.filter(c => c.status === 'active').length;
        const completedCampaigns = weeklyCampaigns.filter(c => c.status === 'completed').length;
        const totalSpent = weeklyCampaigns.reduce((total, campaign) => total + campaign.spentBudget, 0);

        if (weeklyCampaigns.length > 0) {
          await NotificationService.createNotification({
            recipient: marketer._id,
            type: 'weekly_summary',
            title: 'Weekly Campaign Performance',
            message: `You had ${activeCampaigns} active and ${completedCampaigns} completed campaigns this week. Total spent: ₦${totalSpent}`,
            data: {
              activeCampaigns,
              completedCampaigns,
              totalSpent,
              totalCampaigns: weeklyCampaigns.length,
              period: 'last_week',
              actionUrl: '/analytics/campaigns'
            },
            priority: 'low'
          });
          marketerNotificationsSent++;
        }

      } catch (error) {
        console.error(`Error sending weekly summary to marketer ${marketer._id}:`, error);
      }
    }

    console.log(`Weekly summaries sent: ${promoterNotificationsSent} to promoters, ${marketerNotificationsSent} to marketers`);

  } catch (error) {
    console.error('Error in weekly performance summary job:', error);
  }
});

// 5. Low Balance Monitoring - Every 6 hours
//cron.schedule('*/1 * * * *', async () => {
cron.schedule('0 */6 * * *', async () => {
  // Existing low balance monitoring
  try {
    console.log('Running low balance monitoring job...');
    
    // Find marketers with low wallet balance
    const marketers = await UserModel.find({ 
      role: 'marketer',
      isActive: true,
      isDeleted: false,
      'wallets.marketer.balance': { $lt: 5000 } // Threshold: ₦5000
    });

    let lowBalanceNotificationsSent = 0;

    for (const marketer of marketers) {
      try {
        // Check if user has active campaigns that could be affected
        const activeCampaigns = await CampaignModel.find({
          owner: marketer._id,
          status: 'active'
        });

        if (activeCampaigns.length > 0) {
          // Check if we haven't sent a low balance notification recently
          const recentNotification = await CampaignModel.findOne({
            owner: marketer._id,
            'notificationLog.type': 'low_balance',
            'notificationLog.sentAt': { 
              $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
            }
          });

          if (!recentNotification) {
            await NotificationService.createLowBalanceNotification(
              marketer._id,
              marketer.wallets.marketer.balance,
              activeCampaigns[0] // Use first active campaign as reference
            );
            lowBalanceNotificationsSent++;

            // Log the notification in one of the active campaigns
            if (activeCampaigns[0]) {
              await activeCampaigns[0].logNotification('low_balance', marketer._id, {
                currentBalance: marketer.wallets.marketer.balance,
                threshold: 5000
              });
            }
          }
        }

      } catch (error) {
        console.error(`Error sending low balance notification to marketer ${marketer._id}:`, error);
      }
    }

    console.log(`Low balance notifications sent: ${lowBalanceNotificationsSent}`);

  } catch (error) {
    console.error('Error in low balance monitoring job:', error);
  }
});

// Enhanced cleanup job with better logging and error handling
//cron.schedule('*/1 * * * *', async () => {
cron.schedule('0 2 * * *', async () => {
  const jobStartTime = new Date();
  console.log(`🔄 [${jobStartTime.toISOString()}] Starting notification cleanup job...`);
  
  try {
    // Configuration
    const retentionDays = 7;
    const batchSize = 1000; // Process in batches to avoid memory issues
    
    // Count notifications to be deleted
    const countBefore = await NotificationModel.countOldReadNotifications(retentionDays);
    console.log(`📊 Found ${countBefore} read/dismissed notifications older than ${retentionDays} days`);
    
    if (countBefore === 0) {
      console.log('✅ No old notifications to clean up');
      return;
    }
    
    // Perform cleanup in batches if there are many notifications
    let totalDeleted = 0;
    
    if (countBefore > batchSize) {
      console.log(`🔄 Large dataset detected (${countBefore} items), processing in batches...`);
      
      let batchNumber = 1;
      let remaining = countBefore;
      
      while (remaining > 0) {
        const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
        
        const result = await NotificationModel.deleteMany({
          status: { $in: ['read', 'dismissed'] },
          $or: [
            { readAt: { $lt: cutoffDate } },
            { 
              status: { $in: ['read', 'dismissed'] },
              readAt: { $exists: false },
              createdAt: { $lt: cutoffDate }
            }
          ]
        }).limit(batchSize);
        
        totalDeleted += result.deletedCount;
        remaining = await NotificationModel.countOldReadNotifications(retentionDays);
        
        console.log(`📦 Batch ${batchNumber}: Deleted ${result.deletedCount} notifications (${remaining} remaining)`);
        batchNumber++;
        
        // Small delay between batches to avoid overwhelming the database
        if (remaining > 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } else {
      // Single deletion for smaller datasets
      const result = await NotificationModel.cleanupOldReadNotifications(retentionDays);
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
    
    console.error(`❌ Notification cleanup job failed after ${duration.toFixed(2)} seconds:`, error);
    
    // You might want to send an alert here for critical failures
    // await sendAdminAlert('Notification cleanup job failed', error.message);
  }
});





/* For Admin */

// Validation reminder for submitted promotions (Daily at 10 AM)
/* cron.schedule('0 10 * * *', async () => {
  try {
    console.log('Running validation reminder job...');
    
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

console.log('Notification scheduler started successfully');
export default cron;