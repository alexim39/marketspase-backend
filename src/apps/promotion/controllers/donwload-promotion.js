import { CampaignModel } from "../../campaign/models/campaign.model.js";
import { PromotionModel } from "../../promotion/models/promotion.model.js";
import { UserModel } from "../../user/models/user.model.js";
import mongoose from "mongoose";

/**
 * @description Allows a promoter to download campaign materials and transfer reserved funds
 * from marketer to promoter's reserved wallet (Stage 3).
 */
export const downloadPromotion = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { campaignId, promoterId, promotionId } = req.body;

        // Validate required fields
        if (!campaignId || !promoterId || !promotionId) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                message: "Missing required fields: campaignId, promoterId, and promotionId.",
                success: false,
            });
        }

        // Fetch the necessary documents within the transaction session
        const campaign = await CampaignModel.findById(campaignId).session(session);
        const promoter = await UserModel.findById(promoterId).session(session);
        const promotion = await PromotionModel.findById(promotionId).session(session);
        const marketer = await UserModel.findById(campaign?.owner).session(session);

        // Validation checks
        if (!campaign || !promoter || !marketer) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                message: "Campaign, Promoter, or Marketer not found.",
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
                message: 'User is not authorized to download promotions. Switch to a promoter account.',
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
        
        // --- FIX: Logic for already downloaded promotion (Stage 3 funds already moved) ---
        if (promotion.isDownloaded && promotion.hasReservedForPromoter) {
            await session.abortTransaction();
            session.endSession();
            
            // Just return the URL again for the client to retry the download, without erroring.
            const mediaUrl = getMediaUrl(campaign.mediaUrl, req);

            return res.status(200).json({
                message: "Promotion materials already downloaded. Media URL re-provided.",
                success: true,
                campaign: {
                    title: campaign.title,
                    caption: campaign.caption,
                    link: campaign.link,
                    mediaUrl: mediaUrl,
                    mediaType: campaign.mediaType,
                },
                promotionId: promotion._id,
                reservedAmount: campaign.payoutPerPromotion,
                currentPromoters: campaign.currentPromoters
            });
        }

        // Must have been accepted first (Stage 2: funds reserved on marketer side)
        if (!promotion.hasReservedFromMarketer) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                message: "This promotion was not reserved during acceptance. Please accept campaign first.",
                success: false,
            });
        }

        const payoutAmount = campaign.payoutPerPromotion;

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

        // 1. Transfer funds from marketer's reserved to promoter's reserved (Stage 3)
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
                        description: `Funds transferred to promoter ${promoter.displayName || promoter._id} for campaign: "${campaign.title}"`,
                        relatedCampaign: campaignId,
                        relatedPromotion: promotion._id,
                        status: "reserved_to_promoter", // Use specific status from your schema
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
                            action: 'promotion_downloaded', // Use defined activity type
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
                    hasReservedForPromoter: true,
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

        // Commit transaction
        await session.commitTransaction();
        session.endSession();

        // --- FIX: Construct the media URL for the client response ---
        const mediaUrl = getMediaUrl(campaign.mediaUrl, req);

        res.status(200).json({
            message: "Campaign materials downloaded successfully. Funds have been reserved for your promotion.",
            success: true,
            // Return shape matching the old file
            campaign: {
                title: campaign.title,
                caption: campaign.caption,
                link: campaign.link,
                mediaUrl: mediaUrl, // ⬅️ CRITICAL FIX
                mediaType: campaign.mediaType,
            },
            promotionId: promotion._id, // Use promotion._id directly after commit
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
        
        // Handle common errors
        if (error.name === 'CastError') {
            return res.status(400).json({
                message: "Invalid ID format provided.",
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

/**
 * Helper function to construct a full media URL if it's a relative path.
 * This logic was present in the old code.
 */
function getMediaUrl(mediaUrl, req) {
    if (mediaUrl && !mediaUrl.startsWith('http')) {
        // Assume HTTPS by default for production environments
        const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'https';
        return `${protocol}://${req.get("host")}${mediaUrl}`;
    }
    return mediaUrl;
}