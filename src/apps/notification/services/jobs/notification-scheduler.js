// services/notification-scheduler.js
import cron from 'node-cron';
import { PromotionModel } from '../../../promotion/models/promotion.model.js';
import { CampaignModel } from '../../../campaign/models/campaign.model.js';
import { UserModel } from '../../../user/models/user.model.js';
import { NotificationService } from '../notification.service.js';
import { NotificationModel } from '../../models/notification.model.js';
import { sendEmail } from './../../../../services/emailService.js';
import { promotionExpiringTemplate } from '../../../promotion/services/email/promotionExpiringTemplate.js';
import mongoose from "mongoose";

// 1. 23-HOUR SUBMISSION REMINDER - Every hour
cron.schedule('0 * * * *', async () => {
  try {
    console.log('Running 23-hour submission reminder job...');
    
    const pendingPromotions = await PromotionModel.findPromotionsNeedingSubmissionReminders();

    console.log(`Found ${pendingPromotions.length} promotions at ~23 hours mark`);

    let remindersSent = 0;

    for (const promotion of pendingPromotions) {
      try {
        // Calculate exact hours since assignment
        const now = new Date();
        const assignmentTime = new Date(promotion.createdAt);
        const hoursSinceAssignment = (now - assignmentTime) / (1000 * 60 * 60);
        
        console.log(`Promotion ${promotion._id} is ${hoursSinceAssignment.toFixed(2)} hours old`);
        
        if (promotion.shouldSendSubmissionReminder()) {
          const campaign = await CampaignModel.findById(promotion.campaign);
          
          // Calculate hours left until WhatsApp status expires (24 hours total)
          const hoursLeft = Math.max(1, Math.ceil(24 - hoursSinceAssignment));
          
          console.log(`Sending reminder for promotion ${promotion._id} - ${hoursLeft} hour(s) left`);
          
          await NotificationService.createSubmissionReminder(
            promotion.promoter._id,
            campaign,
            promotion,
            hoursLeft
          );
          
          await promotion.recordSubmissionReminder();
          remindersSent++;

          const promoter = promotion.promoter;
          const emailData = {
            promoterName: promoter.displayName,
            campaignTitle: campaign.title,
            promotionId: promotion.upi || promotion._id.toString(),
            payoutAmount: campaign.payoutPerPromotion,
            expiresAt: new Date(assignmentTime.getTime() + (24 * 60 * 60 * 1000))
          };

          // Send email
          const emailContent = promotionExpiringTemplate(emailData);
          //Send welcome email to the user
          await sendEmail(promoter.email, `⏰ 1 Hour Left: Upload Proof for ${campaign.title}`, emailContent);
  
          // Update promotion activity log
          promotion.activityLog.push({
            action: 'Expiration Reminder Sent',
            details: '1-hour expiration reminder email sent to promoter',
            timestamp: new Date()
          });

          await promotion.save();
          
          console.log(`✅23-hour reminder sent for promotion ${promotion._id} to ${promoter.email}`);
        }
      } catch (error) {
        console.error(`Error sending reminder for promotion ${promotion._id}:`, error);
      }
    }

    console.log(`23-hour reminder job completed: ${remindersSent} reminders sent`);

  } catch (error) {
    console.error('Error in 23-hour reminder job:', error);
  }
});

// 2. BUDGET ALERTS - Every hour
cron.schedule('0 * * * *', async () => {
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
          marketer.wallets.marketer.balance,
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

// 3. DEADLINE REMINDERS - 8 AM daily
cron.schedule('0 8 * * *', async () => {
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

// 4. WEEKLY PERFORMANCE SUMMARY - Monday 9 AM
cron.schedule('0 9 * * 1', async () => {
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

// 5. LOW BALANCE MONITORING - Every 6 hours
cron.schedule('0 */6 * * *', async () => {
  try {
    console.log('Running low balance monitoring job...');
    
    // Find marketers with low wallet balance
    const marketers = await UserModel.find({ 
      role: 'marketer',
      isActive: true,
      isDeleted: false,
      'wallets.marketer.balance': { $lt: 5000 }
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
              $gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
            }
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

// 6. NOTIFICATION CLEANUP - 2 AM daily
cron.schedule('0 2 * * *', async () => {
  const jobStartTime = new Date();
  console.log(`🔄 [${jobStartTime.toISOString()}] Starting notification cleanup job...`);
  
  try {
    const retentionDays = 7;
    const batchSize = 1000;
    
    const countBefore = await NotificationModel.countOldReadNotifications(retentionDays);
    console.log(`📊 Found ${countBefore} read/dismissed notifications older than ${retentionDays} days`);
    
    if (countBefore === 0) {
      console.log('✅ No old notifications to clean up');
      return;
    }
    
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
        
        if (remaining > 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } else {
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
  }
});

// 7. AUTO-REJECT EXPIRED PROMOTIONS WITH FINANCIAL CLEANUP - Every 6 hours
cron.schedule('0 */6 * * *', async () => {
  const jobStartTime = new Date();
  console.log(`🕐 [${jobStartTime.toISOString()}] Starting auto-reject expired promotions job...`);
  
  try {
    // Calculate time threshold: 24 hours ago
    const twentyFourHoursAgo = new Date(Date.now() - (24 * 60 * 60 * 1000));
    
    // Find expired promotions in BOTH scenarios:
    // 1. Accepted but not downloaded (pending + !isDownloaded)
    // 2. Downloaded but not submitted (pending + isDownloaded)
    const expiredPromotions = await PromotionModel.find({
      status: 'pending',
      createdAt: { $lte: twentyFourHoursAgo }
    })
    .populate('promoter', 'displayName email wallets')
    .populate({
      path: 'campaign',
      populate: { path: 'owner', model: 'User', select: 'displayName email wallets' }
    });

    console.log(`📊 Found ${expiredPromotions.length} expired promotions to process`);

    let rejectedCount = 0;
    let failedCount = 0;
    let refundedAmount = 0;

    for (const promotion of expiredPromotions) {
      const session = await mongoose.startSession();
      
      try {
        await session.startTransaction();

        const campaign = promotion.campaign;
        const promoter = promotion.promoter;
        const marketer = campaign.owner;
        const payoutAmount = promotion.payoutAmount || campaign.payoutPerPromotion;

        // Determine scenario and refund logic
        const scenario = promotion.isDownloaded ? 
          "Downloaded but not submitted" : 
          "Accepted but not downloaded";
        
        console.log(`Processing promotion ${promotion._id}: ${scenario}`);

        // 1. Update promotion status
        promotion.status = 'rejected';
        promotion.rejectionReason = `Promotion expired - ${scenario} within 24 hours`;
        
        promotion.activityLog.push({
          action: 'Auto-Rejected',
          details: `Promotion automatically rejected due to expiration. ${scenario}`,
          timestamp: new Date()
        });

        await promotion.save({ session });

        // 2. Handle financial refunds based on scenario
        if (promotion.isDownloaded) {
          // Scenario 2: Downloaded but not submitted - refund from promoter reserved to marketer reserved
          await UserModel.findByIdAndUpdate(
            promoter._id,
            {
              $inc: { 
                'wallets.promoter.reserved': -payoutAmount
              },
              $push: {
                'wallets.promoter.transactions': {
                  amount: payoutAmount,
                  type: 'debit',
                  category: 'refund',
                  description: `Funds released for expired promotion: ${campaign.title}`,
                  relatedCampaign: campaign._id,
                  relatedPromotion: promotion._id,
                  status: 'reversed',
                  timestamp: new Date()
                }
              }
            },
            { session }
          );

          await UserModel.findByIdAndUpdate(
            marketer._id,
            {
              $inc: { 
                'wallets.marketer.reserved': payoutAmount
              },
              $push: {
                'wallets.marketer.transactions': {
                  amount: payoutAmount,
                  type: 'credit',
                  category: 'refund',
                  description: `Refund for expired promotion: ${promotion.upi || promotion._id}`,
                  relatedCampaign: campaign._id,
                  relatedPromotion: promotion._id,
                  status: 'successful',
                  timestamp: new Date()
                }
              }
            },
            { session }
          );

          console.log(`💰 Refunded ${payoutAmount} from promoter reserved to marketer reserved for promotion ${promotion._id}`);

        } else {
          // Scenario 1: Accepted but not downloaded - refund from marketer reserved to marketer balance
          await UserModel.findByIdAndUpdate(
            marketer._id,
            {
              $inc: { 
                'wallets.marketer.reserved': -payoutAmount,
                'wallets.marketer.balance': payoutAmount
              },
              $push: {
                'wallets.marketer.transactions': {
                  amount: payoutAmount,
                  type: 'credit',
                  category: 'refund',
                  description: `Refund for unclaimed promotion: ${campaign.title}`,
                  relatedCampaign: campaign._id,
                  relatedPromotion: promotion._id,
                  status: 'successful',
                  timestamp: new Date()
                }
              }
            },
            { session }
          );

          console.log(`💰 Refunded ${payoutAmount} from marketer reserved to marketer balance for promotion ${promotion._id}`);
        }

        refundedAmount += payoutAmount;

        // 3. Update campaign stats
        const campaignUpdate = {
          $inc: { 
            currentPromoters: -1,
            totalPromotions: -1
          },
          $push: {
            activityLog: {
              action: 'Promotion Auto-Rejected',
              details: `Promotion ${promotion.upi || promotion._id} auto-rejected. ${scenario}. Refund processed.`,
              timestamp: new Date()
            }
          }
        };

        // If campaign was exhausted, check if it should be reactivated
        if (campaign.status === "exhausted") {
          const potentialSpend = (campaign.spentBudget) + campaign.payoutPerPromotion;
          if (potentialSpend <= campaign.budget) {
            campaignUpdate.$set = { status: 'active' };
            campaignUpdate.$push.activityLog.details += " Campaign reactivated.";
          }
        }

        await CampaignModel.findByIdAndUpdate(
          campaign._id,
          campaignUpdate,
          { session }
        );

        // 4. Send notification to promoter
        if (promoter) {
          await NotificationService.createNotification({
            recipient: promoter._id,
            type: 'promotion_rejected',
            title: 'Promotion Expired ⏰',
            message: `Your promotion for "${campaign.title}" has expired because it wasn't ${promotion.isDownloaded ? 'submitted' : 'started'} within 24 hours.`,
            data: {
              campaignId: campaign._id,
              promotionId: promotion._id,
              rejectionReason: promotion.rejectionReason,
              scenario: scenario,
              actionUrl: '/promotions'
            },
            priority: 'medium'
          });
        }

        // 5. Send notification to marketer about refund
        await NotificationService.createNotification({
          recipient: marketer._id,
          type: 'refund_processed',
          title: 'Funds Refunded ✅',
          message: `₦${payoutAmount} refunded for expired promotion: "${campaign.title}"`,
          data: {
            campaignId: campaign._id,
            promotionId: promotion._id,
            refundAmount: payoutAmount,
            scenario: scenario,
            actionUrl: `/campaigns/${campaign._id}`
          },
          priority: 'medium'
        });

        await session.commitTransaction();
        rejectedCount++;
        console.log(`✅ Auto-rejected and refunded promotion ${promotion._id} (${scenario})`);

      } catch (transactionError) {
        await session.abortTransaction();
        failedCount++;
        console.error(`❌ Failed to auto-reject promotion ${promotion._id}:`, transactionError);
      } finally {
        session.endSession();
      }
    }

    const jobEndTime = new Date();
    const duration = (jobEndTime - jobStartTime) / 1000;
    
    console.log(`🎉 Auto-rejection job completed:
    - Successfully rejected: ${rejectedCount} promotions
    - Failed: ${failedCount} promotions
    - Total refunded: ₦${refundedAmount}
    - Duration: ${duration.toFixed(2)} seconds
    - Finished at: ${jobEndTime.toISOString()}`);
    
  } catch (error) {
    const jobEndTime = new Date();
    const duration = (jobEndTime - jobStartTime) / 1000;
    
    console.error(`❌ Auto-rejection job failed after ${duration.toFixed(2)} seconds:`, error);
  }
});

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

console.log('Notification scheduler started successfully');
export default cron;