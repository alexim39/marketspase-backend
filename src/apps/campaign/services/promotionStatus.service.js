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
      await handleValidation({ promotion, campaign, promoter, performedBy, payoutAmount, session });
      break;
      
    case "rejected":
      await handleRejection({ promotion, campaign, promoter, marketer, performedBy, rejectionReason, payoutAmount, session });
      break;
      
    case "paid":
      await handlePayment({ promotion, campaign, performedBy, payoutAmount, session });
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



const handleValidation = async ({ promotion, campaign, promoter, performedBy, payoutAmount, session }) => {
  if (promotion.status !== "submitted") {
    throw new Error("Cannot validate a promotion that is not in 'submitted' status.");
  }

  // Atomic update for promotion
  await PromotionModel.findByIdAndUpdate(
    promotion._id,
    {
      $set: {
        status: 'validated',
        validatedAt: new Date(),
        validatedBy: performedBy,
        rejectionReason: null
      }
    },
    { session }
  );

  // Atomic updates for campaign
  const campaignUpdate = {
    $inc: {
      validatedPromotions: 1,
      currentPromoters: 1
    },
    $push: {
      activityLog: {
        action: "Promotion Validated",
        details: `Promotion UPI ${promotion.upi} validated. Promoter ${promoter.displayName} earned ${payoutAmount} NGN.`,
        performedBy: performedBy,
        timestamp: new Date()
      }
    }
  };

  // Check if campaign is completed
  if (campaign.validatedPromotions + 1 >= campaign.maxPromoters) {
    campaignUpdate.$set = {
      status: 'completed',
      endDate: new Date()
    };
    campaignUpdate.$push.activityLog = {
      action: "Status Changed",
      details: "All promotions validated - campaign completed",
      performedBy: performedBy,
      timestamp: new Date()
    };
  }

  await CampaignModel.findByIdAndUpdate(
    campaign._id,
    campaignUpdate,
    { session }
  );

  // ✅ FIXED: Proper atomic update for promoter wallet
  await UserModel.findByIdAndUpdate(
    promoter._id, // Use the promoter user ID from the populated promotion
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
  if (promotion.status !== "submitted") {
    throw new Error("Cannot reject a promotion that is not in 'submitted' status.");
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

  // Atomic updates for campaign
  const campaignUpdate = {
    $inc: {
      totalPromotions: -1,
      currentPromoters: -1,
      spentBudget: -payoutAmount
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
    const potentialSpend = (campaign.spentBudget - payoutAmount) + campaign.payoutPerPromotion;
    if (potentialSpend <= campaign.budget) {
      campaignUpdate.$set = { status: 'active' };
      campaignUpdate.$push.activityLog = {
        action: "Status Changed",
        details: "Promotion rejected, campaign reopened",
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

  // ✅ FIXED: Proper atomic updates for both wallets
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

  await UserModel.findByIdAndUpdate(
    marketer._id,
    {
      $inc: {
        'wallets.marketer.reserved': payoutAmount
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



const handlePayment = async ({ promotion, campaign, performedBy, payoutAmount, session }) => {
  if (promotion.status !== "validated") {
    throw new Error("Cannot mark a promotion as 'paid' that is not in 'validated' status.");
  }

  // Atomic update for promotion
  await PromotionModel.findByIdAndUpdate(
    promotion._id,
    {
      $set: {
        status: 'paid',
        paidAt: new Date(),
        paidBy: performedBy
      }
    },
    { session }
  );

  // Check if campaign will be exhausted after this payment
  const willBeExhausted = campaign.spentBudget + payoutAmount >= campaign.budget;

  // Atomic updates for campaign
  await CampaignModel.findByIdAndUpdate(
    campaign._id,
    {
      $inc: {
        paidPromotions: 1,
        spentBudget: payoutAmount
      },
      $set: {
        status: willBeExhausted ? 'exhausted' : campaign.status
      },
      $push: {
        activityLog: {
          action: "Promotion Paid",
          details: `Payout for promotion UPI ${promotion.upi} confirmed.`,
          performedBy: performedBy,
          timestamp: new Date()
        }
      }
    },
    { session }
  );
};