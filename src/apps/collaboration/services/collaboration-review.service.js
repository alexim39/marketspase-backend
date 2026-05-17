import mongoose from "mongoose";
import { CampaignModel } from "../../campaign/models/index.js";
import { PromotionModel } from "../../promotion/models/index.js";
import { UserModel } from "../../user/models/user/index.js";
import { CollaborationReviewModel } from "../models/index.js";
import { toIdString } from "./collaboration-access.service.js";

const REVIEW_ELIGIBILITY_MIN_AGE_MS = 24 * 60 * 60 * 1000;

const pickRelationshipType = ({ reviewerId, revieweeId, campaignOwnerId, promoterId }) => {
  if (toIdString(reviewerId) === toIdString(campaignOwnerId) && toIdString(revieweeId) === toIdString(promoterId)) {
    return "marketer_to_promoter";
  }

  if (toIdString(reviewerId) === toIdString(promoterId) && toIdString(revieweeId) === toIdString(campaignOwnerId)) {
    return "promoter_to_marketer";
  }

  return null;
};

export const recomputeCollaborationRating = async (userId) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return;
  }

  const [summary] = await CollaborationReviewModel.aggregate([
    {
      $match: {
        reviewee: new mongoose.Types.ObjectId(userId),
        status: "published",
      },
    },
    {
      $group: {
        _id: "$reviewee",
        averageRating: { $avg: "$rating" },
        reviewCount: { $sum: 1 },
      },
    },
  ]);

  await UserModel.updateOne(
    { _id: userId },
    {
      $set: {
        collaborationRating: Number(summary?.averageRating || 0),
        collaborationRatingCount: Number(summary?.reviewCount || 0),
        collaborationReviewCount: Number(summary?.reviewCount || 0),
      },
    }
  );
};

export const getReviewEligibility = async ({ reviewerId, revieweeId, promotionId = null }) => {
  if (!mongoose.Types.ObjectId.isValid(reviewerId) || !mongoose.Types.ObjectId.isValid(revieweeId)) {
    return {
      eligible: false,
      reason: "Invalid reviewer or review target.",
    };
  }

  if (toIdString(reviewerId) === toIdString(revieweeId)) {
    return {
      eligible: false,
      reason: "You cannot review yourself.",
    };
  }

  let promotion = null;
  let campaign = null;

  if (promotionId) {
    if (!mongoose.Types.ObjectId.isValid(promotionId)) {
      return {
        eligible: false,
        reason: "Invalid promotion.",
      };
    }

    promotion = await PromotionModel.findById(promotionId)
      .select("_id promoter campaign status acceptedAt clickStats isActive")
      .lean();

    if (!promotion) {
      return {
        eligible: false,
        reason: "Promotion not found.",
      };
    }

    campaign = await CampaignModel.findById(promotion.campaign)
      .select("_id owner title status")
      .lean();

    if (!campaign) {
      return {
        eligible: false,
        reason: "Campaign not found.",
      };
    }
  } else {
    const candidatePromotions = await PromotionModel.find({
      status: { $in: ["accepted", "paid", "rejected"] },
      isActive: { $in: [true, false] },
    })
      .select("_id promoter campaign status acceptedAt clickStats isActive")
      .sort({ acceptedAt: -1, createdAt: -1 })
      .lean();

    const campaignIds = candidatePromotions.map((item) => item.campaign);
    const campaigns = await CampaignModel.find({
      _id: { $in: campaignIds },
    })
      .select("_id owner title status")
      .lean();

    const campaignMap = new Map(campaigns.map((item) => [toIdString(item._id), item]));

    const eligiblePromotion = candidatePromotions.find((item) => {
      const relatedCampaign = campaignMap.get(toIdString(item.campaign));
      if (!relatedCampaign) return false;

      const relationshipType = pickRelationshipType({
        reviewerId,
        revieweeId,
        campaignOwnerId: relatedCampaign.owner,
        promoterId: item.promoter,
      });

      if (!relationshipType) return false;

      const hasClicks = Number(item.clickStats?.billableClicks || item.clickStats?.totalClicks || 0) > 0;
      const campaignInactive = ["exhausted", "expired", "completed", "paused"].includes(String(relatedCampaign.status || ""));
      const isMatureEnough = item.acceptedAt && ((Date.now() - new Date(item.acceptedAt).getTime()) >= REVIEW_ELIGIBILITY_MIN_AGE_MS);

      return hasClicks || campaignInactive || isMatureEnough;
    });

    if (!eligiblePromotion) {
      return {
        eligible: false,
        reason: "A completed or active collaboration record is required before leaving a review.",
      };
    }

    promotion = eligiblePromotion;
    campaign = campaignMap.get(toIdString(eligiblePromotion.campaign));
  }

  const relationshipType = pickRelationshipType({
    reviewerId,
    revieweeId,
    campaignOwnerId: campaign.owner,
    promoterId: promotion.promoter,
  });

  if (!relationshipType) {
    return {
      eligible: false,
      reason: "This review must stay between the linked marketer and promoter.",
    };
  }

  const existingReview = await CollaborationReviewModel.findOne({
    reviewer: reviewerId,
    reviewee: revieweeId,
    promotion: promotion._id,
  })
    .select("_id status rating")
    .lean();

  if (existingReview) {
    return {
      eligible: false,
      reason: "You have already reviewed this collaboration.",
      existingReview,
      promotion,
      campaign,
      relationshipType,
    };
  }

  const hasClicks = Number(promotion.clickStats?.billableClicks || promotion.clickStats?.totalClicks || 0) > 0;
  const campaignInactive = ["exhausted", "expired", "completed", "paused"].includes(String(campaign.status || ""));
  const isMatureEnough = promotion.acceptedAt && ((Date.now() - new Date(promotion.acceptedAt).getTime()) >= REVIEW_ELIGIBILITY_MIN_AGE_MS);

  if (!hasClicks && !campaignInactive && !isMatureEnough) {
    return {
      eligible: false,
      reason: "Please allow the collaboration to progress before leaving feedback.",
      promotion,
      campaign,
      relationshipType,
    };
  }

  return {
    eligible: true,
    promotion,
    campaign,
    relationshipType,
  };
};
