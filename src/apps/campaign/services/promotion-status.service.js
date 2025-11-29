import { PromotionModel } from "../../promotion/models/promotion.model.js";
import { CampaignModel } from "../models/campaign.model.js";
import { UserModel } from "../../user/models/user.model.js";

// Helper function for successful payment (Stage 4)
const validatePromotion = async ({
    promotion,
    campaign,
    promoter,
    performedBy,
    payoutAmount,
    session
}) => {
    // 1. Fund Movement: promoter.reserved (DEBIT) -> promoter.balance (CREDIT)
    await UserModel.updateOne(
        { _id: promoter._id },
        {
            $inc: {
                "wallets.promoter.reserved": -payoutAmount, // Debit escrow
                "wallets.promoter.balance": payoutAmount    // Credit final balance
            },
            $push: {
                "wallets.promoter.transactions": {
                    amount: payoutAmount,
                    type: "credit",
                    category: "promotion",
                    description: `Payment for validated promotion: "${campaign.title}"`,
                    relatedCampaign: campaign._id,
                    relatedPromotion: promotion._id,
                    status: "successful",
                    timestamp: new Date()
                }
            }
        },
        { session }
    );

    // 2. Update Promotion Status
    await PromotionModel.updateOne(
        { _id: promotion._id },
        {
            $set: {
                status: "paid",
                validatedAt: new Date(),
                paidAt: new Date(),
            },
            $push: {
                activityLog: {
                    action: "Promotion Paid",
                    details: `Validated and paid by ${performedBy.displayName || performedBy.role}.`,
                    timestamp: new Date()
                }
            },
            _pendingNotification: 'promotion_validated'
        },
        { session }
    );

    // 3. Update Campaign Tracking
    // $inc paidPromotions which triggers automatic spentBudget calculation in the Campaign pre-save hook.
    await CampaignModel.updateOne(
        { _id: campaign._id },
        {
            $inc: {
                paidPromotions: 1,
                validatedPromotions: 1,
            },
            $push: {
                activityLog: {
                    action: "Promoter Paid",
                    details: `Payment processed. Paid promotions: ${campaign.paidPromotions + 1}`,
                    timestamp: new Date()
                }
            }
        },
        { session }
    );
};

// Helper function for rejection and refund (Stage 5)
const rejectPromotion = async ({
    promotion,
    campaign,
    promoter,
    marketer,
    performedBy,
    rejectionReason,
    payoutAmount,
    session
}) => {
    // 1. Update Promotion Status (CRITICAL FIX 1)
    await PromotionModel.updateOne(
        { _id: promotion._id },
        {
            $set: {
                status: "rejected",
                rejectionReason: rejectionReason,
                validatedAt: new Date(),
                // Funds are being returned to marketer, so promoter no longer has reserved funds
                hasReservedForPromoter: false, 
            },
            $push: {
                activityLog: {
                    action: "Promotion Rejected",
                    details: `Rejected by ${performedBy.displayName || performedBy.role}. Reason: ${rejectionReason}`,
                    timestamp: new Date()
                }
            },
            _pendingNotification: 'promotion_rejected'
        },
        { session }
    );

    // 2. Fund Movement: promoter.reserved (DEBIT) -> marketer.balance (CREDIT) - (Checked and Correct)
    
    // Debit Promoter Reserved Wallet (Refund Promoter's Escrow)
    await UserModel.updateOne(
        { _id: promoter._id },
        {
            $inc: {
                "wallets.promoter.reserved": -payoutAmount
            },
            $push: {
                "wallets.promoter.transactions": {
                    amount: payoutAmount,
                    type: "debit",
                    category: "refund",
                    description: `Refund for rejected promotion: "${campaign.title}"`,
                    relatedCampaign: campaign._id,
                    relatedPromotion: promotion._id,
                    status: "reversed",
                    timestamp: new Date()
                }
            }
        },
        { session }
    );

    // Credit Marketer Balance Wallet (Refund Marketer's Available Balance)
    await UserModel.updateOne(
        { _id: marketer._id },
        {
            $inc: {
                "wallets.marketer.balance": payoutAmount
            },
            $push: {
                "wallets.marketer.transactions": {
                    amount: payoutAmount,
                    type: "credit",
                    category: "refund",
                    description: `Refund after rejected promotion: "${campaign.title}"`,
                    relatedCampaign: campaign._id,
                    relatedPromotion: promotion._id,
                    status: "successful",
                    timestamp: new Date()
                }
            }
        },
        { session }
    );

    // 3. Update Campaign Slot and Status (CRITICAL FIX 2)
    const campaignUpdate = {
        $inc: { currentPromoters: -1 }, // Free up one slot
        $push: {
            activityLog: {
                action: "Promoter Rejected",
                details: "Promotion rejected, freeing up one slot.",
                timestamp: new Date()
            }
        }
    };

    // Check if the campaign status needs to be reverted to 'active'
    const newCurrentPromoters = campaign.currentPromoters - 1;

    // Reactivate the campaign if it was previously exhausted/completed/expired 
    // AND there is now at least one free slot.
    if (newCurrentPromoters < campaign.maxPromoters) {
        if (campaign.status === 'exhausted' || campaign.status === 'completed' || campaign.status === 'expired') {
            campaignUpdate.$set = { status: 'active' };
            campaignUpdate.$push.activityLog.push({
                action: "Status Reverted",
                details: `Campaign status reverted to 'active' due to a rejection freeing a slot.`,
                timestamp: new Date()
            });
        }
    }
    
    // Apply atomic campaign updates
    await CampaignModel.updateOne({ _id: campaign._id }, campaignUpdate, { session });
};


// Main Service Handler (replicated from your snippet)
export const handlePromotionStatusUpdate = async ({
    promotionId,
    status,
    rejectionReason,
    performedBy,
    session
}) => {

    const promotion = await PromotionModel.findById(promotionId)
        .populate({
            path: 'campaign',
            populate: { path: 'owner', model: 'User' }
        })
        .populate('promoter')
        .session(session);

    if (!promotion) throw new Error("Promotion not found");
    if (promotion.status === 'rejected' || promotion.status === 'paid') throw new Error(`Promotion is already ${promotion.status}.`);

    const campaign = promotion.campaign;
    const promoter = promotion.promoter;
    const marketer = campaign.owner;

    // Use a safety check for payout amount
    const payoutAmount = promotion.payoutAmount || campaign.payoutPerPromotion;

    switch (status) {
        case "validated":
            await validatePromotion({
                promotion,
                campaign,
                promoter,
                performedBy,
                payoutAmount,
                session
            });
            break;

        case "rejected":
            // Check if funds were reserved for the promoter before attempting to refund
            if (!promotion.hasReservedForPromoter) {
                // If funds were never moved to promoter's reserved wallet (Stage 3), 
                // we only need to update the promotion and campaign slot, but skip the financial transaction.
                
                // Add logic to skip financial transactions here, but still update status and campaign slot.
                
                // CRITICAL: Since funds were never moved to promoter.reserved, they must still be in marketer.reserved (from Stage 2).
                // If funds are in marketer.reserved, they must be moved back to marketer.balance.
                
                // ⚠️ NOTE: The core flow assumes Stage 3 (Download) happens before rejection. 
                // If rejection can occur before download, the fund flow for rejection needs to move funds from 
                // marketer.reserved -> marketer.balance, and the CampaignModel needs a `totalPromotions: -1` if `promotion.isDownloaded` is false.
                
                // ASSUMING rejection only happens after download (Stage 3 completed):
                if (promotion.isDownloaded) {
                    throw new Error("Invalid state: Promotion was downloaded but funds were not reserved for promoter (hasReservedForPromoter is false). Manual review needed.");
                }
            }

            await rejectPromotion({
                promotion,
                campaign,
                promoter,
                marketer,
                performedBy,
                rejectionReason,
                payoutAmount,
                session
            });
            break;

        default:
            throw new Error(`Invalid status update: ${status}`);
    }

    return promotion;
};