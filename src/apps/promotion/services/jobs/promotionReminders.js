// jobs/promotionReminders.js
import { PromotionModel } from '../../models/promotion.model.js';
import { sendEmail } from './../../../../services/emailService.js';
import { promotionExpiringTemplate } from '../../services/email/promotionExpiringTemplate.js';
import cron from 'node-cron';

/**
 * Check for promotions that are 23 hours old and send expiration reminders
 * This runs every 15 minutes to catch promotions at the right time
 */
export const checkExpiringPromotions = async () => {
  try {
    console.log('🔔 Checking for expiring promotions...');
    
    // Calculate time threshold: 23 hours ago
    const twentyThreeHoursAgo = new Date(Date.now() - (23 * 60 * 60 * 1000));
    
    // Find promotions that:
    // - Are exactly around 23 hours old (created 23 hours ago ± 15 minutes)
    // - Have status 'pending' (not submitted proof yet)
    // - Haven't been reminded already (we'll track this in activityLog)
    const expiringPromotions = await PromotionModel.find({
      status: 'pending',
      createdAt: {
        $gte: new Date(twentyThreeHoursAgo.getTime() - (15 * 60 * 1000)), // 22 hours 45 minutes
        $lte: new Date(twentyThreeHoursAgo.getTime() + (15 * 60 * 1000))  // 23 hours 15 minutes
      },
      'activityLog.action': { $ne: 'Expiration Reminder Sent' } // Avoid duplicate reminders
    })
    .populate('promoter', 'displayName email')
    .populate('campaign', 'title payoutPerPromotion');

    console.log(`📧 Found ${expiringPromotions.length} promotions needing reminders`);

    // Send reminders for each expiring promotion
    for (const promotion of expiringPromotions) {
      try {
        const promoter = promotion.promoter;
        const campaign = promotion.campaign;
        
        if (!promoter || !promoter.email || !campaign) {
          console.warn(`Skipping promotion ${promotion._id}: missing promoter or campaign data`);
          continue;
        }

        // Calculate expiration time (24 hours from creation)
        const expirationTime = new Date(promotion.createdAt.getTime() + (24 * 60 * 60 * 1000));

        // Prepare email data
        const emailData = {
          promoterName: promoter.displayName,
          campaignTitle: campaign.title,
          promotionId: promotion.upi || promotion._id.toString(),
          payoutAmount: campaign.payoutPerPromotion,
          expiresAt: expirationTime
        };

        // Send email
        const emailContent = promotionExpiringTemplate(emailData);
        await sendEmail({
          to: promoter.email,
          subject: `⏰ 1 Hour Left: Upload Proof for "${campaign.title}"`,
          html: emailContent
        });

        // Update promotion activity log
        promotion.activityLog.push({
          action: 'Expiration Reminder Sent',
          details: '1-hour expiration reminder email sent to promoter',
          timestamp: new Date()
        });

        await promotion.save();

        console.log(`✅ Reminder sent for promotion ${promotion._id} to ${promoter.email}`);
        
        // Small delay to avoid overwhelming email service
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (promotionError) {
        console.error(`❌ Failed to process reminder for promotion ${promotion._id}:`, promotionError);
        // Continue with other promotions even if one fails
      }
    }

    console.log(`🎉 Promotion reminder process completed. Sent ${expiringPromotions.length} reminders.`);
    
  } catch (error) {
    console.error('❌ Error in promotion reminder cron job:', error);
  }
};

/**
 * Additional job to auto-reject expired promotions (24+ hours old)
 * This runs every 30 minutes
 */
// export const autoRejectExpiredPromotions = async () => {
//   try {
//     console.log('🕐 Checking for expired promotions...');
    
//     // Calculate time threshold: 24 hours ago
//     const twentyFourHoursAgo = new Date(Date.now() - (24 * 60 * 60 * 1000));
    
//     // Find promotions that:
//     // - Are older than 24 hours
//     // - Still have status 'pending' (never submitted proof)
//     const expiredPromotions = await PromotionModel.find({
//       status: 'pending',
//       createdAt: { $lte: twentyFourHoursAgo }
//     })
//     .populate('campaign', 'title');

//     console.log(`🗑️ Found ${expiredPromotions.length} expired promotions to reject`);

//     for (const promotion of expiredPromotions) {
//       try {
//         // Auto-reject the promotion
//         promotion.status = 'rejected';
//         promotion.rejectionReason = 'Promotion expired - Proof not submitted within 24 hours';
        
//         promotion.activityLog.push({
//           action: 'Auto-Rejected',
//           details: 'Promotion automatically rejected due to expiration (24 hours elapsed)',
//           timestamp: new Date()
//         });

//         await promotion.save();
//         console.log(`✅ Auto-rejected expired promotion ${promotion._id}`);
        
//       } catch (rejectError) {
//         console.error(`❌ Failed to auto-reject promotion ${promotion._id}:`, rejectError);
//       }
//     }

//     console.log(`🎉 Auto-rejection process completed. Rejected ${expiredPromotions.length} promotions.`);
    
//   } catch (error) {
//     console.error('❌ Error in auto-rejection cron job:', error);
//   }
// };

// Schedule the jobs
export const startPromotionReminderJobs = () => {
  // Check for expiring promotions every 15 minutes
  cron.schedule('*/15 * * * *', checkExpiringPromotions);
  
  // Auto-reject expired promotions every 30 minutes
  //cron.schedule('*/30 * * * *', autoRejectExpiredPromotions);
  
  console.log('🚀 Promotion reminder cron jobs started');
  console.log('   - Expiration reminders: every 15 minutes');
  //console.log('   - Auto-rejections: every 30 minutes');
};