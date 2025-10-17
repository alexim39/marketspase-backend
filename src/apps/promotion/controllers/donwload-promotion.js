import { CampaignModel } from "../../campaign/models/campaign.model.js";
import { PromotionModel } from "../../promotion/models/promotion.model.js";
import { UserModel } from "../../user/models/user.model.js";
import mongoose from "mongoose";

/**
 * @description Allows a promoter to download campaign materials and transfer reserved funds
 * from marketer to promoter's reserved wallet.
 */
export const downloadPromotion = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { campaignId, promoterId } = req.body;

    // Validate required fields
    if (!campaignId || !promoterId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Missing required fields: campaignId and promoterId.",
        success: false,
      });
    }

    // Find the campaign, promotion, and users within transaction
    const campaign = await CampaignModel.findById(campaignId).session(session);
    const promoter = await UserModel.findById(promoterId).session(session);
    const promotion = await PromotionModel.findOne({
      campaign: campaignId,
      promoter: promoterId
    }).session(session);

    // Validation checks
    if (!campaign || !promoter) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        message: "Campaign or Promoter not found.",
        success: false,
      });
    }

    if (!promotion) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        message: "Promotion record not found. Please accept the campaign first.",
        success: false,
      });
    }

    // Check if user is a promoter
    if (promoter.role !== 'promoter') {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        message: 'User is not authorized to download promotions.',
        success: false,
      });
    }

    // Check if campaign is active
    if (campaign.status !== 'active') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: `Campaign is not active. Current status: ${campaign.status}`,
        success: false,
      });
    }

    // Check if promotion is already downloaded
    if (promotion.isDownloaded) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: 'Promotion materials already downloaded.',
        success: false,
      });
    }

    const payoutAmount = campaign.payoutPerPromotion;
    const marketer = await UserModel.findById(campaign.owner).session(session);

    // Validate wallet structures exist
    if (!marketer?.wallets?.marketer || !promoter?.wallets?.promoter) {
      await session.abortTransaction();
      session.endSession();
      return res.status(500).json({
        message: "Wallet structure is incomplete.",
        success: false,
      });
    }

    // Check if marketer has sufficient reserved funds
    if (marketer.wallets.marketer.reserved < payoutAmount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(402).json({
        message: "Insufficient reserved funds in marketer's wallet.",
        success: false,
      });
    }

    // 1. Transfer funds from marketer's reserved to promoter's reserved
    // ✅ Use atomic update for marketer wallet
    await UserModel.updateOne(
      { _id: marketer._id },
      { 
        $inc: { 
          'wallets.marketer.reserved': -payoutAmount 
        },
        $push: {
          'wallets.marketer.transactions': {
            amount: payoutAmount,
            type: "debit",
            category: "campaign",
            description: `Funds transferred to promoter ${promoter.displayName} for campaign: "${campaign.title}"`,
            relatedCampaign: campaignId,
            relatedPromotion: promotion._id,
            status: "successful",
            timestamp: new Date()
          }
        }
      },
      { session }
    );

    // ✅ Use atomic update for promoter wallet and activity log
    await UserModel.updateOne(
      { _id: promoter._id },
      { 
        $inc: { 
          'wallets.promoter.reserved': payoutAmount 
        },
        $push: {
          'wallets.promoter.transactions': {
            amount: payoutAmount,
            type: "credit",
            category: "promotion",
            description: `Funds reserved from campaign: "${campaign.title}"`,
            relatedCampaign: campaignId,
            relatedPromotion: promotion._id,
            status: "reserved",
            timestamp: new Date()
          },
          activityLog: {
            $each: [{
              action: 'campaign_update',
              description: `You downloaded campaign materials: "${campaign.title}"`,
              details: {
                campaignTitle: campaign.title,
                campaignId: campaignId,
                payoutAmount: payoutAmount,
                downloadTime: new Date()
              },
              timestamp: new Date()
            }],
            $position: 0,
            $slice: 1000 // Keep only latest 1000 activities
          }
        }
      },
      { session }
    );

    // 2. Update promotion record using atomic update
    await PromotionModel.updateOne(
      { _id: promotion._id },
      {
        $set: {
          isDownloaded: true,
          notes: "Campaign materials downloaded by promoter"
        },
        $push: {
          activityLog: {
            action: "Campaign Downloaded",
            details: "Promoter downloaded campaign materials and funds transferred",
            timestamp: new Date()
          }
        }
      },
      { session }
    );

    // 3. ✅ No need to save documents individually - atomic updates already applied

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    // Refresh promotion data to get updated document
    const updatedPromotion = await PromotionModel.findById(promotion._id);

    // Construct media URL safely
    let mediaUrl = campaign.mediaUrl;
    if (mediaUrl && !mediaUrl.startsWith('http')) {
      const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
      mediaUrl = `${protocol}://${req.get("host")}${campaign.mediaUrl}`;
    }

    res.status(200).json({
      message: "Campaign materials downloaded successfully. Funds have been reserved for your promotion.",
      success: true,
      campaign: {
        title: campaign.title,
        caption: campaign.caption,
        link: campaign.link,
        mediaUrl: mediaUrl,
        mediaType: campaign.mediaType,
      },
      promotionId: updatedPromotion._id,
      reservedAmount: payoutAmount,
      currentPromoters: campaign.currentPromoters
    });

  } catch (error) {
    // Enhanced error handling with safe transaction cleanup
    try {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
    } catch (abortError) {
      console.error("Error aborting transaction:", abortError.message);
    } finally {
      session.endSession();
    }
    
    console.error("Error downloading promotion:", error.message);
    
    // More specific error handling
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        message: "Data validation failed. Please check the provided information.",
        success: false,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }

    if (error.name === 'CastError') {
      return res.status(400).json({
        message: "Invalid ID format provided.",
        success: false,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }

    if (error.name === 'VersionError') {
      return res.status(409).json({
        message: "Data conflict detected. Please try again.",
        success: false,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    
    res.status(500).json({
      message: "Error occurred while processing the download request.",
      success: false,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};