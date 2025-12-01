
import { CampaignModel } from "../../campaign/models/campaign.model.js";
import { PromotionModel } from "../../promotion/models/promotion.model.js";
import { UserModel } from "../../user/models/user.model.js";
import mongoose from "mongoose";

/**
 * @description Allows a promoter to download campaign materials and transfer reserved funds
 * from marketer to promoter's reserved wallet (Stage 3).
 * - Atomic & guarded: prevents negative reserved values
 * - Preserves embedded transactions + activity logs
 */
export const downloadPromotion = async (req, res) => {
  const session = await mongoose.startSession();
  // Capture the transaction outputs here
  let txResult = null;

  try {
    await session.withTransaction(async () => {
      const { campaignId, promoterId, promotionId } = req.body;

      // Validate required fields
      if (!campaignId || !promoterId || !promotionId) {
        throw { status: 400, message: "Missing required fields: campaignId, promoterId, and promotionId." };
      }

      // Fetch docs in the transaction session
      const campaign = await CampaignModel.findById(campaignId).session(session);
      const promoter = await UserModel.findById(promoterId).session(session);
      const promotion = await PromotionModel.findById(promotionId).session(session);
      const marketer  = await UserModel.findById(campaign?.owner).session(session);

      // Basic validations
      if (!campaign || !promoter || !marketer) {
        throw { status: 404, message: "Campaign, Promoter, or Marketer not found." };
      }
      if (!promotion) {
        throw { status: 404, message: "Promotion record not found. Please accept the campaign first." };
      }
      if (promoter.role !== 'promoter') {
        throw { status: 403, message: 'User is not authorized to download promotions. Switch to a promoter account.' };
      }
      if (campaign.status !== 'active') {
        throw { status: 400, message: `Campaign is not active. Current status: ${campaign.status}` };
      }

      // Idempotency: already downloaded & reserved to promoter
      if (promotion.isDownloaded && promotion.hasReservedForPromoter) {
        const payoutAmountAlready = Number(promotion?.payoutAmount ?? campaign?.payoutPerPromotion ?? 0);
        txResult = {
          alreadyDownloaded: true,
          campaign,
          promotion,
          payoutAmount: payoutAmountAlready
        };
        return; // exit early; transaction will commit as no writes are needed
      }

      // Must have been accepted (Stage 2 reserve on marketer side)
      if (!promotion.hasReservedFromMarketer) {
        throw { status: 400, message: "This promotion was not reserved during acceptance. Please accept campaign first." };
      }

      // Determine payout amount (prefer promotion snapshot if present)
      const payoutAmount = Number(promotion?.payoutAmount ?? campaign?.payoutPerPromotion ?? 0);
      if (!Number.isFinite(payoutAmount) || payoutAmount <= 0) {
        throw { status: 400, message: "Invalid payout amount." };
      }

      // ---- Stage 3: marketer.reserved -> promoter.reserved (guarded, atomic) ----
      // 1) Debit marketer.reserved with a $gte guard to prevent negatives + push transaction
      const debitRes = await UserModel.updateOne(
        {
          _id: marketer._id,
          'wallets.marketer.reserved': { $gte: payoutAmount } // guard: prevents negative reserved
        },
        {
          $inc: { 'wallets.marketer.reserved': -payoutAmount },
          $push: {
            'wallets.marketer.transactions': {
              amount: payoutAmount,
              type: "debit",
              category: "campaign",
              description: `Funds transferred to promoter ${promoter.displayName ?? promoter._id} for campaign: "${campaign.title}"`,
              relatedCampaign: campaignId,
              relatedPromotion: promotion._id,
              status: "reserved_to_promoter",
              createdAt: new Date()
            }
          }
        },
        { session }
      );
      if (!debitRes.modifiedCount) {
        throw { status: 402, message: "Insufficient reserved funds in marketer's wallet." };
      }

      // 2) Credit promoter.reserved + push transaction + activityLog (atomic)
      const creditRes = await UserModel.updateOne(
        { _id: promoter._id },
        {
          $inc: { 'wallets.promoter.reserved': payoutAmount },
          $push: {
            'wallets.promoter.transactions': {
              amount: payoutAmount,
              type: "credit",
              category: "promotion",
              description: `Funds reserved from campaign: "${campaign.title}"`,
              relatedCampaign: campaignId,
              relatedPromotion: promotion._id,
              status: "reserved",
              createdAt: new Date()
            },
            activityLog: {
              $each: [{
                action: 'promotion_downloaded',
                description: `You downloaded campaign materials: "${campaign.title}"`,
                resourceType: 'campaign',
                resourceId: campaignId,
                metadata: {
                  campaignTitle: campaign.title,
                  payoutAmount,
                  downloadTime: new Date()
                },
                timestamp: new Date()
              }],
              $position: 0,
              $slice: 1000
            }
          }
        },
        { session }
      );
      if (!creditRes.modifiedCount) {
        throw { status: 500, message: "Failed to credit promoter's reserved wallet." };
      }

      // 3) Update promotion flags & timestamps
      await PromotionModel.updateOne(
        { _id: promotion._id },
        {
          $set: {
            isDownloaded: true,
            hasReservedForPromoter: true,
            notes: "Campaign materials downloaded by promoter",
            downloadedAt: new Date()
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

      // Capture outputs for response AFTER commit
      //console.log(`Download promotion transaction completed successfully. with campaign ${campaignId} and promotion ${promotionId} and amount ${payoutAmount}`);
      txResult = { campaign, promotion, payoutAmount };
    }, {
      readPreference: 'primary',
      readConcern: { level: 'local' },
      writeConcern: { w: 'majority' }
    });

    // ------- Build response after transaction -------
    if (!txResult || !txResult.campaign) {
      console.log("Transaction completed but no result returned.", txResult);
      return res.status(500).json({
        message: "Campaign data missing after transaction.",
        success: false
      });
    }

    const mediaUrl = getMediaUrl(txResult.campaign.mediaUrl, req);

    // Idempotent branch
    if (txResult.alreadyDownloaded) {
      return res.status(200).json({
        message: "Promotion materials already downloaded. Media URL re-provided.",
        success: true,
        campaign: {
          title: txResult.campaign.title,
          caption: txResult.campaign.caption,
          link: txResult.campaign.link,
          mediaUrl,
          mediaType: txResult.campaign.mediaType
        },
        promotionId: txResult.promotion._id,
        reservedAmount: txResult.payoutAmount,
        currentPromoters: txResult.campaign.currentPromoters
      });
    }

    // Normal success response
    return res.status(200).json({
      message: "Campaign materials downloaded successfully. Funds have been reserved for your promotion.",
      success: true,
      campaign: {
        title: txResult.campaign.title,
        caption: txResult.campaign.caption,
        link: txResult.campaign.link,
        mediaUrl,
        mediaType: txResult.campaign.mediaType
      },
      promotionId: txResult.promotion._id,
      reservedAmount: txResult.payoutAmount,
      currentPromoters: txResult.campaign.currentPromoters
    });
  } catch (error) {
    // Clean up the session if an error occurs
    try {
      if (session.inTransaction()) await session.abortTransaction();
    } catch (abortError) {
      console.error("Error aborting transaction:", abortError.message);
    }
    console.error("Error downloading promotion:", error.message, error);

    if (error.name === 'CastError') {
      return res.status(400).json({
        message: "Invalid ID format provided.",
        success: false,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    const status = error.status || 500;
    return res.status(status).json({
      message: error.message || "Error occurred while processing the download request.",
      success: false,
      error: process.env.NODE_ENV === 'development' ? (error.message || String(error)) : undefined
    });
  } finally {
    // Ensure session is ended
    try { session.endSession(); } catch {}
  }
};

/**
 * Helper to construct a full media URL for relative paths.
 */
function getMediaUrl(mediaUrl, req) {
  if (mediaUrl && !mediaUrl.startsWith('http')) {
    const protocol =
      (req.secure || req.headers['x-forwarded-proto'] === 'https') ? 'https' : 'http'; // <-- fix: use 'http' when not https
    return `${protocol}://${req.get("host")}${mediaUrl}`;
  }
  return mediaUrl;
}
