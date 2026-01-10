
import { CampaignModel } from "../../campaign/models/campaign.model.js";
import { PromotionModel } from "../../promotion/models/promotion.model.js";
import { UserModel } from "../../user/models/user.model.js";
import mongoose from "mongoose";

const MAX_RETRIES = 5;

export const downloadPromotion = async (req, res) => {
  const { campaignId, promoterId, promotionId } = req.body;

  // Validate early (outside txn)
  if (!campaignId || !promoterId || !promotionId) {
    return res.status(400).json({
      message: "Missing required fields: campaignId, promoterId, and promotionId.",
      success: false,
    });
  }

  const conn = mongoose; // same connection used by models

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const session = await conn.startSession();
    let txResult = null;

    try {
      await session.withTransaction(async () => {
        // parallel reads (same session)
        const [campaign, promotionDoc, promoter] = await Promise.all([
          CampaignModel.findById(campaignId).session(session),
          PromotionModel.findById(promotionId).session(session),
          UserModel.findById(promoterId).session(session),
        ]);

        if (!campaign || !promoter) {
          throw { status: 404, message: "Campaign or Promoter not found." };
        }
        const marketer = await UserModel.findById(campaign.owner).session(session);
        if (!marketer) throw { status: 404, message: "Marketer not found." };

        if (promoter.role !== 'promoter') {
          throw { status: 403, message: 'User is not authorized to download promotions. Switch to a promoter account.' };
        }
        if (campaign.status !== 'active') {
          throw { status: 400, message: `Campaign is not active. Current status: ${campaign.status}` };
        }
        if (!promotionDoc) {
          throw { status: 404, message: "Promotion record not found. Please accept the campaign first." };
        }
        if (!promotionDoc.hasReservedFromMarketer) {
          throw { status: 400, message: "This promotion was not reserved during acceptance. Please accept campaign first." };
        }

        // ===== Atomic lock on the promotion (transaction-scoped) =====
        const now = new Date();
        const lockedPromo = await PromotionModel.findOneAndUpdate(
          {
            _id: promotionId,
            isDownloaded: false,
            hasReservedForPromoter: false,
            hasReservedFromMarketer: true
          },
          { $set: { isDownloaded: true, status: "downloaded", downloadedAt: now, notes: "Campaign materials downloaded by promoter" } },
          { new: true, session }
        );

        // If already downloaded earlier in another txn, return idempotent success
        if (!lockedPromo) {
          const already = await PromotionModel.findById(promotionId).session(session);
          if (already?.isDownloaded && already?.hasReservedForPromoter) {
            txResult = {
              alreadyDownloaded: true,
              campaign,
              promotion: already,
              payoutAmount: Number(already?.payoutAmount ?? campaign?.payoutPerPromotion ?? 0),
            };
            return;
          }
          throw { status: 409, message: "Promotion already claimed or not eligible." };
        }

        const payoutAmount = Number(lockedPromo?.payoutAmount ?? campaign?.payoutPerPromotion ?? 0);
        if (!Number.isFinite(payoutAmount) || payoutAmount <= 0) {
          throw { status: 400, message: "Invalid payout amount." };
        }

        // ===== Stage 3: marketer.reserved -> promoter.reserved =====

        // 1) Debit marketer.reserved with guard + capped transactions array
        const debitRes = await UserModel.updateOne(
          { _id: marketer._id, 'wallets.marketer.reserved': { $gte: payoutAmount } },
          {
            $inc: { 'wallets.marketer.reserved': -payoutAmount },
            $push: {
              'wallets.marketer.transactions': {
                $each: [{
                  amount: payoutAmount,
                  type: "debit",
                  category: "campaign",
                  description: `Funds transferred to promoter ${promoter.displayName ?? promoter._id} for campaign: "${campaign.title}"`,
                  relatedCampaign: campaignId,
                  relatedPromotion: promotionId,
                  status: "reserved_to_promoter",
                  createdAt: now
                }],
                $position: 0,
                $slice: 500
              }
            }
          },
          { session }
        );
        if (!debitRes.modifiedCount) {
          throw { status: 402, message: "Insufficient reserved funds in marketer's wallet." };
        }

        // 2) Credit promoter.reserved + capped transactions + activity
        const creditRes = await UserModel.updateOne(
          { _id: promoter._id },
          {
            $inc: { 'wallets.promoter.reserved': payoutAmount },
            $push: {
              'wallets.promoter.transactions': {
                $each: [{
                  amount: payoutAmount,
                  type: "credit",
                  category: "promotion",
                  description: `Funds reserved from campaign: "${campaign.title}"`,
                  relatedCampaign: campaignId,
                  relatedPromotion: promotionId,
                  status: "reserved",
                  createdAt: now
                }],
                $position: 0,
                $slice: 500
              },
              activityLog: {
                $each: [{
                  action: 'promotion_downloaded',
                  description: `You downloaded campaign materials: "${campaign.title}"`,
                  resourceType: 'campaign',
                  resourceId: campaignId,
                  metadata: { campaignTitle: campaign.title, payoutAmount, downloadTime: now },
                  timestamp: now
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

        // 3) Finalize promotion flags (hasReservedForPromoter) + activity log
        await PromotionModel.updateOne(
          { _id: promotionId },
          {
            $set: { hasReservedForPromoter: true },
            $push: {
              activityLog: {
                $each: [{
                  action: "Campaign Downloaded",
                  details: "Promoter downloaded campaign materials and funds transferred",
                  timestamp: now
                }],
                $position: 0,
                $slice: 500
              }
            }
          },
          { session }
        );

        txResult = { campaign, promotion: lockedPromo, payoutAmount };
      }, {
        // defaults to readConcern "snapshot" – don't override to "local"
        writeConcern: { w: 'majority' }
      });

      // Success response (after commit)
      const mediaUrl = getMediaUrl(txResult.campaign.mediaUrl, req);
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
      try { if (session.inTransaction()) await session.abortTransaction(); } catch {}
      session.endSession();

      const labels = error?.errorLabels || [];
      const isWriteConflict =
        error?.code === 112 ||
        labels.includes('TransientTransactionError') ||
        labels.includes('UnknownTransactionCommitResult');

      if (isWriteConflict && attempt < MAX_RETRIES) {
        // Exponential backoff: 50, 100, 200, 400 ms...
        const backoff = Math.min(50 * (2 ** (attempt - 1)), 1000);
        await new Promise(r => setTimeout(r, backoff));
        continue; // retry whole transaction
      }

      // Non-retryable or exhausted retries
      const status = error.status || 500;
      const msg = error.message || "Error occurred while processing the download request.";
      return res.status(status).json({
        message: msg,
        success: false,
        error: process.env.NODE_ENV === 'development' ? String(error) : undefined
      });
    }
  }
};

// unchanged helper (already optimal)
function getMediaUrl(mediaUrl, req) {
  if (mediaUrl && !mediaUrl.startsWith('http')) {
    const protocol = (req.secure || req.headers['x-forwarded-proto'] === 'https') ? 'https' : 'http';
    return `${protocol}://${req.get("host")}${mediaUrl}`;
  }
  return mediaUrl;
}
