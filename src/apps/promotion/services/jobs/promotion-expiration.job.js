
import cron from 'node-cron';
import mongoose from 'mongoose';
import { PromotionModel } from '../../models/promotion.model.js';
import { UserModel } from '../../../user/models/user.model.js';
import { CampaignModel } from '../../../campaign/models/campaign.model.js';
import { NotificationService } from '../../../notification/services/notification.service.js';

// Helper function to handle the refund logic
const handleExpiredPromotion = async (promotion, session) => {
  try {
    // Get payout amount - use promotion's payoutAmount or fallback to campaign's payoutPerPromotion
    const payoutAmount = promotion.payoutAmount || (promotion.campaign ? promotion.campaign.payoutPerPromotion : 0);
    
    if (!promotion.campaign || !promotion.promoter) {
      console.error('Missing campaign or promoter reference for promotion:', promotion._id);
      return;
    }

    const campaignId = promotion.campaign._id || promotion.campaign;
    const promoterId = promotion.promoter._id || promotion.promoter;
    const marketerId = promotion.campaign.owner?._id || promotion.campaign.owner;

    if (!campaignId || !promoterId || !marketerId) {
      console.error('Missing required IDs for promotion:', promotion._id);
      return;
    }

    // 1. Get fresh instances within the transaction
    const promoter = await UserModel.findById(promoterId).session(session);
    const freshCampaign = await CampaignModel.findById(campaignId).session(session);
    const freshMarketer = await UserModel.findById(marketerId).session(session);

    if (!promoter || !freshCampaign || !freshMarketer) {
      console.error('Missing user/campaign references for promotion:', promotion._id);
      return;
    }

    // 2. Update promotion status
    promotion.status = 'rejected';
    promotion.rejectionReason = 'Proof not submitted within 24 hours of creation.';
    promotion.activityLog.push({
      action: "Promotion Expired",
      details: "Promotion expired due to no proof submission within 24 hours",
      timestamp: new Date()
    });

    // 3. Update campaign stats
    freshCampaign.currentPromoters = Math.max(0, freshCampaign.currentPromoters - 1);
    freshCampaign.totalPromotions = Math.max(0, freshCampaign.totalPromotions - 1);
    
    // Only adjust spentBudget if it was previously incremented for this promotion
    // Note: In your current flow, spentBudget is only updated when payments are made
    // So we don't need to adjust it here since no payment was processed
    
    freshCampaign.activityLog.push({
      action: "Promotion Expired",
      details: `Promotion UPI ${promotion.upi} expired without submission.`,
      timestamp: new Date()
    });

    // 4. Check if campaign should be reactivated (if it was exhausted due to budget)
    if (freshCampaign.status === "exhausted" && freshCampaign.canAssignPromoter()) {
      freshCampaign.status = "active";
      freshCampaign.activityLog.push({
        action: "Campaign Reactivated",
        details: "Campaign reactivated due to expired promotion freeing up slot",
        timestamp: new Date()
      });
    }

    // 5. Save all documents
    await promotion.save({ session });
    await freshCampaign.save({ session });

    console.log(`✅ Processed expired promotion: ${promotion.upi}`);

    // 6. Send notification to promoter
    try {
      await NotificationService.createNotification({
        recipient: promoterId,
        type: 'promotion_rejected',
        title: 'Promotion Expired ⏰',
        message: `Your promotion for "${freshCampaign.title}" has expired because proof wasn't submitted within 24 hours.`,
        data: {
          campaignId: freshCampaign._id,
          promotionId: promotion._id,
          rejectionReason: promotion.rejectionReason,
          actionUrl: '/promotions'
        },
        priority: 'medium'
      });
    } catch (notificationError) {
      console.error(`Failed to send notification for promotion ${promotion._id}:`, notificationError);
    }

  } catch (error) {
    console.error(`Error processing promotion ${promotion._id}:`, error);
    throw error; // Re-throw to trigger transaction abort
  }
};

export const PromotionExpirationCheckerCronJobs = () => {
  // Schedule a cron job to run every hour for more frequent checks
  cron.schedule('0 * * * *', async () => {
    console.log('🕐 Running promotion expiration check...');
    const session = await mongoose.startSession();
    
    try {
      await session.withTransaction(async () => {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const twentyThreeHoursAgo = new Date(Date.now() - 23 * 60 * 60 * 1000);

        // Find all pending promotions created more than 24 hours ago
        // but check in batches to avoid memory issues
        const expiredPromotions = await PromotionModel.find({
          status: 'pending',
          createdAt: { 
            $lt: twentyFourHoursAgo,
            $gt: twentyThreeHoursAgo // Process in 1-hour windows to avoid overloading
          }
        })
        .populate({
          path: 'campaign',
          select: 'title payoutPerPromotion owner status currentPromoters totalPromotions',
          populate: {
            path: 'owner',
            model: 'User',
            select: 'displayName email'
          },
        })
        .populate({
          path: 'promoter',
          select: 'displayName email'
        })
        .session(session)
        .limit(100); // Limit batch size

        if (expiredPromotions.length === 0) {
          console.log('✅ No expired promotions found in this batch.');
          return;
        }

        console.log(`📊 Found ${expiredPromotions.length} expired promotions.`);

        // Process promotions in sequence to avoid overwhelming the database
        for (const promotion of expiredPromotions) {
          await handleExpiredPromotion(promotion, session);
        }

        console.log('🎉 Promotion expiration batch processed successfully.');
      });
    } catch (error) {
      console.error('❌ Error in promotion expiration cron job:', error);
    } finally {
      await session.endSession();
    }
  });

  // Additional cron job to handle edge cases and cleanup (daily at 3 AM)
  cron.schedule('0 3 * * *', async () => {
    console.log('🧹 Running promotion cleanup check...');
    
    try {
      // Find and cleanup any promotions that might have been missed (older than 48 hours)
      const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
      
      const missedPromotions = await PromotionModel.find({
        status: 'pending',
        createdAt: { $lt: twoDaysAgo }
      })
      .populate('campaign', 'title')
      .populate('promoter', 'displayName')
      .limit(50); // Limit to avoid overloading

      if (missedPromotions.length > 0) {
        console.log(`🔄 Found ${missedPromotions.length} missed expired promotions.`);
        
        const session = await mongoose.startSession();
        try {
          await session.withTransaction(async () => {
            for (const promotion of missedPromotions) {
              try {
                // Update promotion status
                promotion.status = 'rejected';
                promotion.rejectionReason = 'Auto-rejected by system cleanup (missed by hourly job)';
                promotion.activityLog.push({
                  action: "Auto-Rejected",
                  details: "Promotion auto-rejected by system cleanup job",
                  timestamp: new Date()
                });

                await promotion.save({ session });

                // Update campaign stats
                if (promotion.campaign) {
                  await CampaignModel.findByIdAndUpdate(
                    promotion.campaign._id,
                    { 
                      $inc: { 
                        currentPromoters: -1,
                        totalPromotions: -1
                      },
                      $push: {
                        activityLog: {
                          action: "Promotion Auto-Rejected",
                          details: `Promotion ${promotion.upi} auto-rejected by cleanup job. Promoter: ${promotion.promoter?.displayName || 'Unknown'}`,
                          timestamp: new Date()
                        }
                      }
                    },
                    { session }
                  );
                }

                console.log(`✅ Cleaned up missed promotion: ${promotion.upi}`);
                
              } catch (promotionError) {
                console.error(`❌ Failed to cleanup promotion ${promotion._id}:`, promotionError);
              }
            }
          });
        } catch (transactionError) {
          console.error('❌ Transaction failed in cleanup job:', transactionError);
        } finally {
          await session.endSession();
        }
      } else {
        console.log('✅ No missed promotions found in cleanup.');
      }
    } catch (error) {
      console.error('❌ Error in promotion cleanup cron job:', error);
    }
  });

  console.log('🚀 Promotion expiration cron jobs started successfully.');
};
