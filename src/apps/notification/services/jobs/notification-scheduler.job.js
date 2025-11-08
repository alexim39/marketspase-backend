// services/notification-scheduler.js
import cron from 'node-cron';
import { PromotionModel } from '../../../promotion/models/promotion.model.js';
import { CampaignModel } from '../../../campaign/models/campaign.model.js';
import { UserModel } from '../../../user/models/user.model.js';
import { NotificationService } from '../notification.service.js';
import { NotificationModel } from '../../models/notification.model.js';
import { sendEmail } from '../../../../services/email.service.js';
import { promotionExpiringTemplate } from '../../../promotion/services/email/promotionExpiringTemplate.js';
import mongoose from "mongoose";

// 1. 20-HOUR SUBMISSION REMINDER - Every hour
cron.schedule('0 * * * *', async () => {
//cron.schedule('*/2 * * * *', async () => {
  try {
    console.log('Running 20-hour submission reminder job...');
    
    // NOTE: The implementation of this model method must be updated
    // to specifically look for promotions assigned between ~19 and ~21 hours ago.
    const pendingPromotions = await PromotionModel.findPromotionsNeedingSubmissionReminders();

    console.log(`Found ${pendingPromotions.length} promotions at ~20 hours mark`);

    let remindersSent = 0;

    for (const promotion of pendingPromotions) {
      try {
        // Calculate exact hours since assignment
        const now = new Date();
        const assignmentTime = new Date(promotion.createdAt);
        const hoursSinceAssignment = (now - assignmentTime) / (1000 * 60 * 60);
        
        console.log(`Promotion ${promotion._id} is ${hoursSinceAssignment.toFixed(2)} hours old`);
        
        // The internal logic of shouldSendSubmissionReminder() must be updated to check for
        // the 20-hour window (e.g., if (hoursSinceAssignment >= 19.5 && hoursSinceAssignment < 20.5))
        if (promotion.shouldSendSubmissionReminder()) {
          const campaign = await CampaignModel.findById(promotion.campaign);
          
          // Calculate hours left until WhatsApp status expires (24 hours total)
          // The reminder is now sent when ~4 hours are left.
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
          const hoursLeftText = hoursLeft > 1 ? `${hoursLeft} Hours` : '1 Hour';
          const emailData = {
            promoterName: promoter.displayName,
            campaignTitle: campaign.title,
            promotionId: promotion.upi || promotion._id.toString(),
            payoutAmount: campaign.payoutPerPromotion,
            expiresAt: new Date(assignmentTime.getTime() + (24 * 60 * 60 * 1000))
          };

          // Send email
          const emailContent = promotionExpiringTemplate(emailData);
          // Updated email subject to reflect the remaining time (~4 hours)
          await sendEmail(promoter.email, `⏳ ${hoursLeftText} Left: You Can Now Upload Proof for ${campaign.title}`, emailContent);
  
          // Update promotion activity log
          promotion.activityLog.push({
            action: 'Expiration Reminder Sent',
            details: `${hoursLeftText} expiration reminder email sent to promoter`,
            timestamp: new Date()
          });

          await promotion.save();
          
          console.log(`✅20-hour reminder sent for promotion ${promotion._id} to ${promoter.email} with ${hoursLeft} hours left`);
        }
      } catch (error) {
        console.error(`Error sending reminder for promotion ${promotion._id}:`, error);
      }
    }

    console.log(`20-hour reminder job completed: ${remindersSent} reminders sent`);

  } catch (error) {
    console.error('Error in 20-hour reminder job:', error);
  }
});

// 1. 23-HOUR SUBMISSION REMINDER - Every hour
/* cron.schedule('0 * * * *', async () => {
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
}); */

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


// 7. AUTO-REJECT EXPIRED PROMOTIONS WITH FINANCIAL CLEANUP - Every 5 hours
cron.schedule('0 */5 * * *', async () => {
//cron.schedule('*/2 * * * *', async () => {
     const jobStartTime = new Date();
    console.log(`🕐 [${jobStartTime.toISOString()}] Starting auto-reject expired promotions job...`);
    
    try {
        // Calculate time threshold: 24 hours ago
        const twentyFourHoursAgo = new Date(Date.now() - (24 * 60 * 60 * 1000));
        
        // Find expired promotions in BOTH scenarios:
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
            
            const campaign = promotion.campaign;
            const promoter = promotion.promoter;
            const marketer = campaign.owner;
            const payoutAmount = promotion.payoutAmount || campaign.payoutPerPromotion;
            
            // Determine scenario
            const scenario = promotion.isDownloaded ? 
                "Downloaded but not submitted" : 
                "Accepted but not downloaded";
            
            const MAX_RETRIES = 3;
            let success = false;
            let finalError = null;

            // --- Transaction Retry Loop to handle TransientTransactionError ---
            for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                const session = await mongoose.startSession();
                try {
                    session.startTransaction();

                    console.log(`Processing promotion ${promotion._id} (Attempt ${attempt}/${MAX_RETRIES}): ${scenario}`);

                    // 1. Update promotion status using explicit $set
                    const promotionUpdate = {
                        $set: {
                            status: 'rejected',
                            rejectionReason: `Promotion expired - ${scenario} within 24 hours`
                        }
                    };

                    // Conditionally add $push for activityLog ONLY on the first attempt
                    if (attempt === 1) {
                        promotionUpdate.$push = {
                            activityLog: {
                                action: 'Auto-Rejected',
                                details: `Promotion automatically rejected due to expiration. ${scenario}`,
                                timestamp: new Date()
                            }
                        };
                    }

                    // Execute the update
                    await PromotionModel.findByIdAndUpdate(
                        promotion._id,
                        promotionUpdate,
                        { session }
                    );

                    // 2. Handle financial refunds based on scenario

                    if (promotion.isDownloaded) {
                        // Scenario 2: Downloaded but not submitted
                        // Move funds from promoter.reserved -> marketer.balance (marketer keeps funds for another promoter to claim)

                        // Promoter Update (Reserved Wallet Debit)
                        const promoterUpdate = {
                            $inc: { 'wallets.promoter.reserved': -payoutAmount },
                            ...(attempt === 1 && {
                                $push: {
                                    'wallets.promoter.transactions': {
                                        amount: payoutAmount,
                                        type: 'debit',
                                        category: 'refund', // keep within allowed enum
                                        meta: { subCategory: 'reserved_release' }, // preserve semantics
                                        description: `Reserved funds released due to expired promotion: ${campaign.title}`,
                                        relatedCampaign: campaign._id,
                                        relatedPromotion: promotion._id,
                                        status: 'reversed',
                                        timestamp: new Date()
                                    }
                                }
                            })
                        };

                        await UserModel.findByIdAndUpdate(
                            promoter._id,
                            promoterUpdate,
                            { session }
                        );

                        // Marketer Update: CREDIT marketer.balance (increase balance) — funds moved to marketer's balance account
                        const marketerUpdateScenario2 = {
                            $inc: {
                                'wallets.marketer.balance': payoutAmount
                            },
                            ...(attempt === 1 && {
                                $push: {
                                    'wallets.marketer.transactions': {
                                        amount: payoutAmount,
                                        type: 'credit',
                                        category: 'credit', // use allowed enum
                                        meta: { subCategory: 'credit' }, // keep original meaning
                                        description: `Reserved funds received for expired promotion: ${promotion.upi || promotion._id}`,
                                        relatedCampaign: campaign._id,
                                        relatedPromotion: promotion._id,
                                        status: 'successful',
                                        timestamp: new Date()
                                    }
                                }
                            })
                        };

                        await UserModel.findByIdAndUpdate(
                            marketer._id,
                            marketerUpdateScenario2,
                            { session }
                        );

                        console.log(`💰 Moved ${payoutAmount} from promoter reserved to marketer reserved for promotion ${promotion._id}`);

                    } else {
                        // Scenario 1: Accepted but not downloaded - refund from marketer reserved back to marketer balance

                        // Marketer Update (Reserved Wallet Debit & Balance Credit)
                        const marketerUpdateScenario1 = {
                            $inc: { 
                                'wallets.marketer.reserved': -payoutAmount,
                                'wallets.marketer.balance': payoutAmount
                            },
                            ...(attempt === 1 && { 
                                $push: {
                                    'wallets.marketer.transactions': {
                                        amount: payoutAmount,
                                        type: 'credit',
                                        category: 'credit', // use allowed enum
                                        meta: { subCategory: 'refund' }, // preserve semantics
                                        description: `Refund for unclaimed promotion: ${campaign.title}`,
                                        relatedCampaign: campaign._id,
                                        relatedPromotion: promotion._id,
                                        status: 'successful',
                                        timestamp: new Date()
                                    }
                                }
                            })
                        };
                        
                        await UserModel.findByIdAndUpdate(
                            marketer._id,
                            marketerUpdateScenario1,
                            { session }
                        );

                        console.log(`💰 Refunded ${payoutAmount} from marketer reserved to marketer balance for promotion ${promotion._id}`);
                    }

                    // 3. Update campaign stats
                    const campaignUpdate = {
                        $inc: { 
                            currentPromoters: -1,
                            totalPromotions: -1 
                        }
                    };
                    
                    // Conditionally add $push for activityLog
                    if (attempt === 1) {
                        campaignUpdate.$push = {
                            activityLog: {
                                action: 'Promotion Auto-Rejected',
                                details: `Promotion ${promotion.upi || promotion._id} auto-rejected. ${scenario}. Refund processed.`,
                                timestamp: new Date()
                            }
                        };
                    }

                    // If campaign was exhausted, check if it should be reactivated
                    const freshCampaign = await CampaignModel.findById(campaign._id).lean();
                    if (freshCampaign.status === "exhausted") {
                      const potentialSpend = freshCampaign.spentBudget || 0;
                      if (potentialSpend <= freshCampaign.budget) {
                        campaignUpdate.$set = { status: 'active' };
                        if (campaignUpdate.$push?.activityLog) {
                          campaignUpdate.$push.activityLog.details += " Campaign reactivated.";
                        }
                      }
                    }

                    // if (campaign.status === "exhausted") {
                    //     const potentialSpend = (campaign.spentBudget || 0);
                    //     if (potentialSpend <= campaign.budget) {
                    //         campaignUpdate.$set = { status: 'active' };
                            
                    //         // If we have an activity log to push (i.e., attempt === 1), append reactivation detail
                    //         if (campaignUpdate.$push?.activityLog) {
                    //             campaignUpdate.$push.activityLog.details += " Campaign reactivated.";
                    //         }
                    //     }
                    // }

                    await CampaignModel.findByIdAndUpdate(
                        campaign._id,
                        campaignUpdate,
                        { session }
                    );

                    // --- COMMIT TRANSACTION ---
                    await session.commitTransaction();
                    success = true; // Mark as success
                    console.log(`✅ Auto-rejected and refunded promotion ${promotion._id} (${scenario}) - committed on attempt ${attempt}`);
                    break; // Exit the retry loop

                } catch (error) {
                    // Attempt to abort the transaction. Catch the error if it was already aborted by the server (NoSuchTransaction)
                    await session.abortTransaction().catch(e => {
                        if (e.codeName !== 'NoSuchTransaction') {
                            console.error(`Failed to abort session for ${promotion._id}: ${e.message}`);
                        }
                    });

                    // Check for TransientTransactionError/WriteConflict for retry
                    const isTransient = error.codeName === 'WriteConflict' || 
                                        (error.errorLabels && error.errorLabels.includes('TransientTransactionError'));
                    
                    if (isTransient && attempt < MAX_RETRIES) {
                        // Implement exponential backoff delay
                        const delay = Math.pow(2, attempt) * 100 + Math.random() * 100;
                        console.warn(`[Retry] Promotion ${promotion._id} failed (Attempt ${attempt}/${MAX_RETRIES}). Transient error (${error.codeName || error.code}). Retrying in ${delay.toFixed(0)}ms...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        finalError = error; // Store the error
                    } else {
                        // Non-transient error or final attempt failure
                        finalError = error;
                        break; // Exit the retry loop
                    }

                } finally {
                    session.endSession();
                }
            } // --- End Transaction Retry Loop ---

            // --- Process result and send notifications (OUTSIDE TRANSACTION) ---
            if (success) {
                rejectedCount++;
                refundedAmount += payoutAmount;

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

            } else {
                failedCount++;
                console.error(`❌ Failed to auto-reject promotion ${promotion._id} after ${MAX_RETRIES} attempts:`, finalError);
            }
        } // --- End outer promotion loop ---

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