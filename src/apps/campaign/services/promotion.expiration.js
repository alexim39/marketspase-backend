/* import cron from 'node-cron';
import mongoose from 'mongoose';
import { PromotionModel } from '../models/promotion.model.js'; // Assuming this path
import { UserModel } from '../../user/models/user.model.js'; // Assuming this path
import { CampaignModel } from '../models/campaign.model.js'; // Assuming this path

// Helper function to handle the refund logic
const handleExpiredPromotion = async (promotion, session) => {
  const payoutAmount = promotion.payoutAmount;
  const campaign = promotion.campaign;
  const marketer = promotion.campaign.owner;

  // 1. Revert funds from the promoter's reserved wallet
  await UserModel.findByIdAndUpdate(
    promotion.promoter,
    { $inc: { 'wallets.promoter.reserved': -payoutAmount } },
    { session }
  );

  // 2. Refund the marketer's reserved wallet
  await UserModel.findByIdAndUpdate(
    marketer._id,
    { $inc: { 'wallets.marketer.reserved': payoutAmount } },
    { session }
  );

  // 3. Add a refund transaction log to the marketer's wallet
  await UserModel.findByIdAndUpdate(
    marketer._id,
    {
      $push: {
        'wallets.marketer.transactions': {
          amount: payoutAmount,
          type: 'credit',
          category: 'refund',
          description: `Refund for unfulfilled promotion: ${promotion._id}`,
          relatedCampaign: campaign._id,
          relatedPromotion: promotion._id,
          status: 'successful',
          createdAt: new Date(),
        },
      },
    },
    { session }
  );

  // 4. Update the promotion's status to rejected and add a reason
  await PromotionModel.findByIdAndUpdate(
    promotion._id,
    {
      status: 'rejected',
      rejectionReason: 'Proof not submitted within 24 hours of creation.',
    },
    { session }
  );

  // 5. Update campaign stats to reflect the refund
  // Revert campaign stats
  await CampaignModel.findByIdAndUpdate(
    campaign._id,
    {
      $inc: {
        currentPromoters: -1,
        spentBudget: -payoutAmount,
      },
      $push: {
        activityLog: {
          action: "Promotion Expired",
          details: `Promotion ID ${promotion._id} expired. Funds refunded to marketer.`,
          timestamp: new Date(),
        },
      },
    },
    { session }
  );
};

export const PromotionExpirationCheckerCronJobs = () => {
  // Schedule a cron job to run every 24 hours
  cron.schedule('0 0 * * *', async () => {
    console.log('Running promotion expiration check...');
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Find all pending promotions created more than 24 hours ago
      const expiredPromotions = await PromotionModel.find({
        status: 'pending',
        createdAt: { $lt: yesterday },
      })
      .populate({
        path: 'campaign',
        populate: {
          path: 'owner',
          model: 'User',
        },
      })
      .session(session);

      if (expiredPromotions.length === 0) {
        console.log('No expired promotions found.');
        await session.commitTransaction();
        session.endSession();
        return;
      }

      console.log(`Found ${expiredPromotions.length} expired promotions.`);

      for (const promotion of expiredPromotions) {
        await handleExpiredPromotion(promotion, session);
      }

      await session.commitTransaction();
      console.log('Promotion expiration check completed successfully.');
    } catch (error) {
      await session.abortTransaction();
      console.error('Error in promotion expiration cron job:', error);
    } finally {
      session.endSession();
    }
  });

  console.log('Cron jobs started. Promotion expiration check scheduled.');
};
 */


import cron from 'node-cron';
import mongoose from 'mongoose';
import { PromotionModel } from '../models/promotion.model.js';
import { UserModel } from '../../user/models/user.model.js';
import { CampaignModel } from '../models/campaign.model.js';

// Helper function to handle the refund logic
const handleExpiredPromotion = async (promotion, session) => {
  try {
    const payoutAmount = promotion.payoutAmount || promotion.campaign.payoutPerPromotion;
    const campaign = promotion.campaign;
    const promoterId = promotion.promoter;
    const marketer = campaign.owner;

    // 1. Get fresh instances within the transaction
    const promoter = await UserModel.findById(promoterId).session(session);
    const freshCampaign = await CampaignModel.findById(campaign._id).session(session);
    const freshMarketer = await UserModel.findById(marketer._id).session(session);

    if (!promoter || !freshCampaign || !freshMarketer) {
      console.error('Missing references for promotion:', promotion._id);
      return;
    }

    // 2. Revert funds from the promoter's reserved wallet
    promoter.wallets.promoter.reserved -= payoutAmount;
    
    // 3. Refund the marketer's reserved wallet
    freshMarketer.wallets.marketer.reserved += payoutAmount;

    // 4. Add transaction logs
    promoter.wallets.promoter.transactions.push({
      amount: payoutAmount,
      type: 'debit',
      category: 'promotion_refund',
      description: `Funds returned for expired promotion: ${promotion.upi}`,
      relatedCampaign: campaign._id,
      relatedPromotion: promotion._id,
      status: 'successful',
    });

    freshMarketer.wallets.marketer.transactions.push({
      amount: payoutAmount,
      type: 'credit',
      category: 'campaign_refund',
      description: `Refund for expired promotion: ${promotion.upi}`,
      relatedCampaign: campaign._id,
      relatedPromotion: promotion._id,
      status: 'successful',
    });

    // 5. Update the promotion status using model method
    promotion.status = 'rejected';
    promotion.rejectionReason = 'Proof not submitted within 24 hours of creation.';
    promotion.activityLog.push({
      action: "Promotion Expired",
      details: "Promotion expired due to no proof submission within 24 hours",
      timestamp: new Date()
    });

    // 6. Update campaign stats using model methods
    freshCampaign.currentPromoters -= 1;
    freshCampaign.totalPromotions -= 1;
    freshCampaign.spentBudget -= payoutAmount;
    
    freshCampaign.activityLog.push({
      action: "Promotion Expired",
      details: `Promotion UPI ${promotion.upi} expired. Funds refunded to marketer.`,
      timestamp: new Date()
    });

    // 7. Check if campaign should be reactivated
    if (freshCampaign.status === "exhausted" && freshCampaign.canAssignPromoter()) {
      freshCampaign.status = "active";
      freshCampaign.activityLog.push({
        action: "Campaign Reactivated",
        details: "Campaign reactivated due to expired promotion",
        timestamp: new Date()
      });
    }

    // 8. Save all documents
    await promoter.save({ session });
    await freshMarketer.save({ session });
    await freshCampaign.save({ session });
    await promotion.save({ session });

    console.log(`Processed expired promotion: ${promotion.upi}`);

  } catch (error) {
    console.error(`Error processing promotion ${promotion._id}:`, error);
    throw error; // Re-throw to trigger transaction abort
  }
};

export const PromotionExpirationCheckerCronJobs = () => {
  // Schedule a cron job to run every hour for more frequent checks
  cron.schedule('0 * * * *', async () => {
    console.log('Running promotion expiration check...');
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
          populate: {
            path: 'owner',
            model: 'User',
          },
        })
        .populate('promoter')
        .session(session);

        if (expiredPromotions.length === 0) {
          console.log('No expired promotions found in this batch.');
          return;
        }

        console.log(`Found ${expiredPromotions.length} expired promotions.`);

        // Process promotions in sequence to avoid overwhelming the database
        for (const promotion of expiredPromotions) {
          await handleExpiredPromotion(promotion, session);
        }

        console.log('Promotion expiration batch processed successfully.');
      });
    } catch (error) {
      console.error('Error in promotion expiration cron job:', error);
    } finally {
      await session.endSession();
    }
  });

  // Additional cron job to handle edge cases and cleanup
  cron.schedule('0 3 * * *', async () => { // Run daily at 3 AM
    console.log('Running promotion cleanup check...');
    
    try {
      // Find and cleanup any promotions that might have been missed
      const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
      
      const missedPromotions = await PromotionModel.find({
        status: 'pending',
        createdAt: { $lt: twoDaysAgo }
      }).limit(100); // Limit to avoid overloading

      if (missedPromotions.length > 0) {
        console.log(`Found ${missedPromotions.length} missed expired promotions.`);
        
        const session = await mongoose.startSession();
        try {
          await session.withTransaction(async () => {
            for (const promotion of missedPromotions) {
              await PromotionModel.findByIdAndUpdate(
                promotion._id,
                {
                  status: 'rejected',
                  rejectionReason: 'Auto-rejected by system cleanup',
                  $push: {
                    activityLog: {
                      action: "Auto-Rejected",
                      details: "Promotion auto-rejected by system cleanup job",
                      timestamp: new Date()
                    }
                  }
                },
                { session }
              );
            }
          });
        } finally {
          await session.endSession();
        }
      }
    } catch (error) {
      console.error('Error in promotion cleanup cron job:', error);
    }
  });

  console.log('Promotion expiration cron jobs started successfully.');
};