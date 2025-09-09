import cron from 'node-cron';
import mongoose from 'mongoose';
import { PromotionModel } from '../models/promotion.model.js'; // Assuming this path
import { UserModel } from '../../user/models/user.model.js'; // Assuming this path
import { CampaignModel } from '../models/campaign.model.js'; // Assuming this path

// Helper function to handle the refund logic
const handleExpiredPromotion = async (promotion, session) => {
  const payoutAmount = promotion.payoutAmount;
  const campaign = promotion.campaign;
  const advertiser = promotion.campaign.owner;

  // 1. Revert funds from the promoter's reserved wallet
  await UserModel.findByIdAndUpdate(
    promotion.promoter,
    { $inc: { 'wallets.promoter.reserved': -payoutAmount } },
    { session }
  );

  // 2. Refund the advertiser's reserved wallet
  await UserModel.findByIdAndUpdate(
    advertiser._id,
    { $inc: { 'wallets.advertiser.reserved': payoutAmount } },
    { session }
  );

  // 3. Add a refund transaction log to the advertiser's wallet
  await UserModel.findByIdAndUpdate(
    advertiser._id,
    {
      $push: {
        'wallets.advertiser.transactions': {
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
          details: `Promotion ID ${promotion._id} expired. Funds refunded to advertiser.`,
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
