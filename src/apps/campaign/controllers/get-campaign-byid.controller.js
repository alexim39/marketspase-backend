import mongoose from "mongoose"; // ADD THIS IMPORT
import { CampaignModel } from "../models/campaign.model.js";

const ACTIVE_PROMOTION_STATUSES = new Set([
  "accepted",
  "downloaded",
  "submitted",
  "validated",
]);

const toFiniteNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizePromotion = (promotion) => {
  const rawPromotion = promotion?.toObject ? promotion.toObject() : promotion;

  return {
    ...rawPromotion,
    acceptedAt: rawPromotion.acceptedAt || rawPromotion.createdAt || null,
    downloadedAt: rawPromotion.downloadedAt || null,
    submittedAt: rawPromotion.submittedAt || null,
    validatedAt: rawPromotion.validatedAt || null,
    rejectedAt: rawPromotion.rejectedAt || null,
    paidAt: rawPromotion.paidAt || null,
    payoutAmount: toFiniteNumber(rawPromotion.payoutAmount),
    costPerClick: toFiniteNumber(rawPromotion.costPerClick),
    clickStats: {
      totalClicks: toFiniteNumber(rawPromotion.clickStats?.totalClicks),
      billableClicks: toFiniteNumber(rawPromotion.clickStats?.billableClicks),
      invalidClicks: toFiniteNumber(rawPromotion.clickStats?.invalidClicks),
      duplicateClicks: toFiniteNumber(rawPromotion.clickStats?.duplicateClicks),
      earnedAmount: toFiniteNumber(rawPromotion.clickStats?.earnedAmount),
      lastClickAt: rawPromotion.clickStats?.lastClickAt || null,
    },
  };
};

const buildPromotionSummary = (promotions) => {
  const uniquePromoters = new Set();
  let activePromotions = 0;
  let totalClicks = 0;
  let billableClicks = 0;
  let invalidClicks = 0;
  let duplicateClicks = 0;
  let earnedAmount = 0;

  for (const promotion of promotions) {
    const promoterId = promotion.promoter?._id || promotion.promoter;
    if (promoterId) {
      uniquePromoters.add(String(promoterId));
    }

    if (ACTIVE_PROMOTION_STATUSES.has(String(promotion.status))) {
      activePromotions += 1;
    }

    totalClicks += toFiniteNumber(promotion.clickStats?.totalClicks);
    billableClicks += toFiniteNumber(promotion.clickStats?.billableClicks);
    invalidClicks += toFiniteNumber(promotion.clickStats?.invalidClicks);
    duplicateClicks += toFiniteNumber(promotion.clickStats?.duplicateClicks);
    earnedAmount += toFiniteNumber(promotion.clickStats?.earnedAmount);
  }

  return {
    totalPromotions: promotions.length,
    activePromotions,
    uniquePromoters: uniquePromoters.size,
    clickStats: {
      totalClicks,
      billableClicks,
      invalidClicks,
      duplicateClicks,
      earnedAmount,
    },
  };
};

const buildCampaignResponse = (campaign) => {
  const rawCampaign = campaign?.toObject ? campaign.toObject() : campaign;
  const promotions = Array.isArray(rawCampaign.promotions)
    ? rawCampaign.promotions.map(normalizePromotion)
    : [];
  const promotionSummary = buildPromotionSummary(promotions);
  const budget = toFiniteNumber(rawCampaign.budget);
  const spentBudget = toFiniteNumber(rawCampaign.spentBudget);
  const reservedBudget = toFiniteNumber(rawCampaign.reservedBudget);
  const remainingBudget = Math.max(budget - spentBudget - reservedBudget, 0);
  const totalClicks = toFiniteNumber(rawCampaign.totalClicks, promotionSummary.clickStats.totalClicks);
  const billableClicks = toFiniteNumber(rawCampaign.billableClicks, promotionSummary.clickStats.billableClicks);
  const invalidClicks = toFiniteNumber(rawCampaign.invalidClicks, promotionSummary.clickStats.invalidClicks);
  const duplicateClicks = toFiniteNumber(rawCampaign.duplicateClicks, promotionSummary.clickStats.duplicateClicks);
  const currentPromoters = Math.max(
    toFiniteNumber(rawCampaign.currentPromoters),
    promotionSummary.uniquePromoters,
  );
  const maxPromoters = toFiniteNumber(rawCampaign.maxPromoters);
  const slotProgress = maxPromoters > 0 ? (currentPromoters / maxPromoters) * 100 : 0;

  return {
    ...rawCampaign,
    promotions,
    currentPromoters,
    totalClicks,
    billableClicks,
    invalidClicks,
    duplicateClicks,
    remainingBudget,
    promotionSummary,
    progress: Math.min(slotProgress, 100),
  };
};

/**
 * Controller to get a single campaign by its ID.
 * It populates the 'owner' field with all user data (excluding the password)
 * and the 'promotions' virtual with all promotion data, including the promoter details.
 */
export const getCampaignById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Campaign ID is required.",
      });
    }

    // ADD OBJECTID VALIDATION
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid campaign ID format.",
      });
    }

    const campaign = await CampaignModel.findById(id)
      .populate({
        path: "owner",
        select: "-password",
      })
      .populate({
        path: "promotions",
        select: `
          status acceptedAt downloadedAt submittedAt validatedAt rejectedAt paidAt
          payoutAmount payoutModel costPerClick payoutSnapshot proofMedia proofViews
          viewsAchieved rejectionReason notes isDownloaded upi promotionUrl destinationUrl
          isActive clickStats createdAt updatedAt promoter
        `,
        populate: {
          path: "promoter",
          select: "displayName username email avatar rating role badgeProfile gamificationProfile",
        },
      })
      .exec();

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Campaign fetched successfully.",
      data: buildCampaignResponse(campaign),
    });
  } catch (error) {
    console.error("Error fetching campaign by ID:", error);
    
    // More specific error handling
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid campaign ID format.",
      });
    }
    
    res.status(500).json({
      success: false,
      message: "An error occurred while fetching the campaign.",
    });
  }
};
