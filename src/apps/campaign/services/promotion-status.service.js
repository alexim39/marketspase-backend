// services/promotionStatus.service.js
import { PromotionModel } from "../../promotion/models/promotion.model.js";
import { CampaignModel } from "../models/campaign.model.js";
import { UserModel } from "../../user/models/user.model.js";

export const handlePromotionStatusUpdate = async ({
  promotionId,
  status,
  rejectionReason,
  performedBy,
  session
}) => {
  // 1. Find promotion with necessary population
  const promotion = await PromotionModel.findById(promotionId)
    .populate({
      path: 'campaign',
      populate: { path: 'owner', model: 'User' }
    })
    .populate('promoter')
    .session(session);

  if (!promotion) {
    throw new Error("Promotion not found");
  }

  const campaign = promotion.campaign;
  const promoter = promotion.promoter;
  const marketer = campaign.owner;
  const payoutAmount = promotion.payoutAmount || campaign.payoutPerPromotion;

  // 2. Handle status transitions with atomic operations
  switch (status) {
    case "validated":
      // FIX: handleValidation now sets status to 'paid' and updates budget/paidPromotions in one go.
      await handleValidation({ promotion, campaign, promoter, performedBy, payoutAmount, session });
      break;
      
    case "rejected":
      await handleRejection({ promotion, campaign, promoter, marketer, performedBy, rejectionReason, payoutAmount, session });
      break;
      
    case "paid":
      // This case is now for legacy or specific manual calls, validation handles the primary payment logic.
      if (promotion.status !== "validated") {
        throw new Error("Cannot mark a promotion as 'paid' that is not in 'validated' status.");
      }
      await PromotionModel.findByIdAndUpdate(
        promotion._id,
        { $set: { status: 'paid', paidAt: new Date(), paidBy: performedBy } },
        { session }
      );
      break;
      
    default:
      throw new Error(`Invalid status: ${status}`);
  }

  // 3. Return updated promotion
  const updatedPromotion = await PromotionModel.findById(promotionId)
    .populate('campaign promoter')
    .session(session);

  return { promotion: updatedPromotion };
};


// REFACTORED: This function now handles the entire success flow (Validation & Payment)
const handleValidation = async ({ promotion, campaign, promoter, performedBy, payoutAmount, session }) => {
  if (promotion.status !== "submitted") {
    throw new Error("Cannot validate a promotion that is not in 'submitted' status.");
  }

  // 1. Check if campaign will be exhausted after this payment
  // We use the *current* spentBudget (which includes reserved funds) to check for exhaustion
  const willBeExhausted = campaign.spentBudget + payoutAmount >= campaign.budget;

  // 2. Atomic update for promotion: Set status directly to 'paid'
  await PromotionModel.findByIdAndUpdate(
    promotion._id,
    {
      $set: {
        status: 'paid', // Transition directly to 'paid' as payment is happening now
        validatedAt: new Date(),
        validatedBy: performedBy,
        paidAt: new Date(), // Set paid date here as it is auto-paid
        rejectionReason: null
      }
    },
    { session }
  );

  // 3. Atomic updates for campaign (Campaign budget and counts)
  const campaignUpdate = {
    $inc: {
      validatedPromotions: 1,
      paidPromotions: 1,
      spentBudget: payoutAmount // Final spent amount is recorded here
      // currentPromoters should not be incremented here as it was already done on acceptance
    },
    $set: {
      status: willBeExhausted ? 'exhausted' : campaign.status // Update status based on new spending
    },
    $push: {
      activityLog: {
        action: "Promotion Validated & Paid",
        details: `Promotion UPI ${promotion.upi} validated and paid. Promoter ${promoter.displayName} earned ${payoutAmount} NGN.`,
        performedBy: performedBy,
        timestamp: new Date()
      }
    }
  };

  // Check if campaign is completed
  if (campaign.paidPromotions + 1 >= campaign.maxPromoters) {
    campaignUpdate.$set.status = 'completed';
    campaignUpdate.$set.endDate = new Date();
  }
  
  // Also set exhausted if needed, even if completed
  if (willBeExhausted && campaignUpdate.$set.status !== 'completed') {
    campaignUpdate.$set.status = 'exhausted';
  }
  
  // Ensure we don't try to push an array of objects into a single object slot if not needed
  if (campaignUpdate.$set.status === 'completed' && !campaignUpdate.$push.activityLog.length) {
     campaignUpdate.$push.activityLog.push({
      action: "Status Changed",
      details: "All promotions paid - campaign completed",
      performedBy: performedBy,
      timestamp: new Date()
    });
  }

  await CampaignModel.findByIdAndUpdate(
    campaign._id,
    campaignUpdate,
    { session }
  );

  // 4. Atomic update for promoter wallet (Fund movement: reserved -> balance)
  await UserModel.findByIdAndUpdate(
    promoter._id,
    {
      $inc: { 
        'wallets.promoter.reserved': -payoutAmount,
        'wallets.promoter.balance': payoutAmount
      },
      $push: {
        'wallets.promoter.transactions': {
          amount: payoutAmount,
          type: 'credit',
          category: 'promotion',
          description: `Earnings from campaign: ${campaign.title} (UPI: ${promotion.upi})`,
          relatedCampaign: campaign._id,
          relatedPromotion: promotion._id,
          status: 'successful',
          timestamp: new Date()
        },
        activityLog: {
          $each: [{
            action: 'promotion_validated',
            description: `Your promotion for "${campaign.title}" was validated and earnings moved to available balance`,
            details: {
              campaignTitle: campaign.title,
              campaignId: campaign._id,
              promotionId: promotion._id,
              amount: payoutAmount,
              validationTime: new Date()
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
};


const handleRejection = async ({ promotion, campaign, promoter, marketer, performedBy, rejectionReason, payoutAmount, session }) => {
  // Allows rejection of 'submitted' or 'pending' promotions
  if (promotion.status !== "submitted" && promotion.status !== "pending") {
    throw new Error("Cannot reject a promotion that is not in 'submitted' or 'pending' status.");
  }

  // Atomic update for promotion
  await PromotionModel.findByIdAndUpdate(
    promotion._id,
    {
      $set: {
        status: 'rejected',
        rejectedAt: new Date(),
        rejectedBy: performedBy,
        rejectionReason: rejectionReason || "No reason provided."
      }
    },
    { session }
  );

  // CRITICAL FIX: The logic here is correct and prevents the budget inflation.
  const campaignUpdate = {
    $inc: {
      // totalPromotions: -1, // ⚠️ REFINEMENT: Removed to avoid potential breaking change/unknown field error
      currentPromoters: -1, // Promoter slot is now free
      spentBudget: -payoutAmount // <-- PERMANENT FIX: Reverse the budget commitment
    },
    $push: {
      activityLog: {
        action: "Promotion Rejected",
        details: `Promotion UPI ${promotion.upi} rejected. Funds refunded to marketer. Reason: ${rejectionReason}.`,
        performedBy: performedBy,
        timestamp: new Date()
      }
    }
  };

  // Check if campaign should be reopened
  if (campaign.status === "exhausted") {
    // Check if the refund makes the campaign viable for at least one more promotion
    const remainingAfterRefund = campaign.budget - (campaign.spentBudget - payoutAmount);
    if (remainingAfterRefund >= campaign.payoutPerPromotion) {
      campaignUpdate.$set = { status: 'active' };
      campaignUpdate.$push.activityLog = {
        action: "Status Changed",
        details: "Promotion rejected, campaign reopened after refund",
        performedBy: performedBy,
        timestamp: new Date()
      };
    }
  }

  await CampaignModel.findByIdAndUpdate(
    campaign._id,
    campaignUpdate,
    { session }
  );

  // 4. Atomic update for promoter wallet (Remove funds from reserved/escrow)
  await UserModel.findByIdAndUpdate(
    promoter._id,
    {
      $inc: {
        'wallets.promoter.reserved': -payoutAmount
      },
      $push: {
        'wallets.promoter.transactions': {
          amount: payoutAmount,
          type: 'debit',
          category: 'refund',
          description: `Funds released for rejected promotion: ${campaign.title}`,
          relatedCampaign: campaign._id,
          relatedPromotion: promotion._id,
          status: 'reversed',
          timestamp: new Date()
        }
      }
    },
    { session }
  );

  // 5. Atomic update for marketer wallet (Refund funds to balance)
  await UserModel.findByIdAndUpdate(
    marketer._id,
    {
      $inc: {
        'wallets.marketer.balance': payoutAmount
      },
      $push: {
        'wallets.marketer.transactions': {
          amount: payoutAmount,
          type: 'credit',
          category: 'refund',
          description: `Refund for rejected promotion: ${promotion.upi}`,
          relatedCampaign: campaign._id,
          relatedPromotion: promotion._id,
          status: 'successful',
          timestamp: new Date()
        }
      }
    },
    { session }
  );
};

// handlePayment is removed as its logic is now merged into handleValidation.