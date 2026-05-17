import { CampaignModel } from "../models/campaign.model.js";
import { PromotionModel } from "../../promotion/models/promotion.model.js";
import { ensureSelfOrAdmin, getAuthenticatedUserId } from "../../../shared/utils/request-auth.util.js";
import {
  getCampaignRemainingBudgetValue,
  normalizeLegacyPpcPromotionStatus,
} from "../services/campaign-runtime.service.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;
const MAX_SEARCH_LENGTH = 100;
const DEFAULT_SORT_FIELD = "createdAt";
const DEFAULT_SORT_ORDER = "desc";

const SORT_FIELD_WHITELIST = new Set([
  "createdAt",
  "updatedAt",
  "startDate",
  "endDate",
  "title",
  "status",
  "category",
  "campaignType",
  "budget",
  "spentBudget",
  "totalClicks",
  "billableClicks",
]);

const CAMPAIGN_LIST_FIELDS = [
  "_id",
  "owner",
  "title",
  "mediaUrl",
  "caption",
  "link",
  "category",
  "mediaType",
  "thumbnailUrl",
  "budget",
  "currency",
  "maxPromoters",
  "currentPromoters",
  "totalPromotions",
  "validatedPromotions",
  "paidPromotions",
  "spentBudget",
  "reservedBudget",
  "totalPayouts",
  "payoutModel",
  "costPerClick",
  "totalClicks",
  "billableClicks",
  "invalidClicks",
  "duplicateClicks",
  "exhaustedAt",
  "lastClickAt",
  "payoutPerPromotion",
  "minViewsPerPromotion",
  "maxViewsPerPromotion",
  "rejectedPromotions",
  "enableTarget",
  "ageTarget",
  "campaignGoal",
  "targetLocations",
  "requirements",
  "minRating",
  "campaignType",
  "priority",
  "startDate",
  "endDate",
  "hasEndDate",
  "status",
  "difficulty",
  "tags",
  "estimatedViews",
  "duration",
  "createdAt",
  "updatedAt",
].join(" ");

const ACTIVE_PROMOTION_STATUSES = new Set(["accepted"]);

const escapeRegExp = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizePaginationValue = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeSort = (sortBy, sortOrder) => {
  const field = SORT_FIELD_WHITELIST.has(sortBy) ? sortBy : DEFAULT_SORT_FIELD;
  const direction = sortOrder === "asc" ? 1 : -1;

  return {
    [field]: direction,
    _id: direction,
  };
};

const buildPromotionSummary = (promotions) => {
  const uniquePromoters = new Set();
  let activePromotions = 0;
  let totalClicks = 0;
  let billableClicks = 0;
  let invalidClicks = 0;
  let duplicateClicks = 0;

  for (const promotion of promotions) {
    if (promotion.promoter) {
      uniquePromoters.add(String(promotion.promoter));
    }

    if (ACTIVE_PROMOTION_STATUSES.has(promotion.status)) {
      activePromotions += 1;
    }

    totalClicks += Number(promotion.clickStats?.totalClicks || 0);
    billableClicks += Number(promotion.clickStats?.billableClicks || 0);
    invalidClicks += Number(promotion.clickStats?.invalidClicks || 0);
    duplicateClicks += Number(promotion.clickStats?.duplicateClicks || 0);
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
    },
  };
};

const buildCampaignResponse = (campaign, promotions) => {
  const budget = Number(campaign.budget || 0);
  const spentBudget = Number(campaign.spentBudget || 0);
  const remainingBudget = getCampaignRemainingBudgetValue(campaign);
  const progress = budget > 0 ? (spentBudget / budget) * 100 : 0;
  const promotionSummary = buildPromotionSummary(promotions);

  return {
    ...campaign,
    remainingBudget,
    progress,
    promotions,
    currentPromoters: promotionSummary.uniquePromoters,
    promotionSummary,
  };
};

/**
 * @description Fetches all campaigns owned by a specific user with pagination.
 * This function uses a read-only database query and does not require a transaction.
 * @param {object} req - The request object from Express.js, expected to contain the user ID and pagination parameters.
 * @param {object} res - The response object from Express.js.
 * @returns {Promise<void>}
 */
export const GetAMarketerCampaigns = async (req, res) => {
  try {
    const { userId } = req.params;
    const { 
      page = DEFAULT_PAGE, 
      limit = DEFAULT_LIMIT,
      status,
      search,
      category,
      campaignType,
      sortBy = DEFAULT_SORT_FIELD,
      sortOrder = DEFAULT_SORT_ORDER
    } = req.query;

    // Validate that the user ID is present.
    if (!userId) {
      return res.status(400).json({
        message: "User ID is required.",
        success: false,
      });
    }

    const authenticatedUserId = getAuthenticatedUserId(req);
    if (!authenticatedUserId) {
      return res.status(401).json({
        message: "Authentication is required to view campaigns.",
        success: false,
      });
    }

    if (!ensureSelfOrAdmin(req, userId, res, "You are not authorized to view these campaigns.")) {
      return;
    }

    // Build query object
    const query = { owner: userId };
    
    // Add status filter if provided and not 'all'
    if (status && status !== "all") {
      query.status = status;
    }
    
    // Add category filter if provided
    if (category) {
      query.category = category;
    }
    
    // Add campaign type filter if provided
    if (campaignType) {
      query.campaignType = campaignType;
    }
    
    // Add search filter if provided
    if (search) {
      const normalizedSearch = String(search).trim().slice(0, MAX_SEARCH_LENGTH);
      const escapedSearch = escapeRegExp(normalizedSearch);

      if (escapedSearch) {
        query.$or = [
          { title: { $regex: escapedSearch, $options: 'i' } },
          { caption: { $regex: escapedSearch, $options: 'i' } },
          { category: { $regex: escapedSearch, $options: 'i' } }
        ];
      }
    }

    // Validate pagination parameters
    const pageNum = normalizePaginationValue(page, DEFAULT_PAGE);
    const limitNum = normalizePaginationValue(limit, DEFAULT_LIMIT);
    
    if (pageNum < 1) {
      return res.status(400).json({
        message: "Page must be greater than 0.",
        success: false,
      });
    }

    if (limitNum < 1 || limitNum > MAX_LIMIT) {
      return res.status(400).json({
        message: `Limit must be between 1 and ${MAX_LIMIT}.`,
        success: false,
      });
    }

    const skip = (pageNum - 1) * limitNum;
    const sort = normalizeSort(sortBy, sortOrder);

    const [totalCampaigns, campaigns] = await Promise.all([
      CampaignModel.countDocuments(query),
      CampaignModel.find(query)
        .select(CAMPAIGN_LIST_FIELDS)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ]);

    const totalPages = Math.ceil(totalCampaigns / limitNum);

    // Check if any campaigns were found.
    if (!campaigns || campaigns.length === 0) {
      return res.status(200).json({
        message: "No campaigns found for this user.",
        success: true,
        data: [],
        pagination: {
          currentPage: pageNum,
          totalPages: 0,
          totalCampaigns: 0,
          hasNext: false,
          hasPrev: false,
          limit: limitNum
        }
      });
    }

    const campaignIds = campaigns.map((campaign) => campaign._id);
    const promotions = await PromotionModel.find({
      campaign: { $in: campaignIds },
    })
      .select("_id campaign promoter status isActive clickStats")
      .lean();

    const promotionsByCampaignId = new Map();
    for (const promotion of promotions) {
      const campaignId = String(promotion.campaign);
      const campaignPromotions = promotionsByCampaignId.get(campaignId) || [];

      campaignPromotions.push({
        _id: String(promotion._id),
        promoter: promotion.promoter ? String(promotion.promoter) : null,
        status: normalizeLegacyPpcPromotionStatus(promotion.status, promotion.isActive),
        clickStats: promotion.clickStats || {
          totalClicks: 0,
          billableClicks: 0,
          invalidClicks: 0,
          duplicateClicks: 0,
          earnedAmount: 0,
        },
      });

      promotionsByCampaignId.set(campaignId, campaignPromotions);
    }

    const normalizedCampaigns = campaigns.map((campaign) => {
      const campaignPromotions = promotionsByCampaignId.get(String(campaign._id)) || [];
      return buildCampaignResponse(campaign, campaignPromotions);
    });

    // Calculate pagination metadata
    const hasNext = pageNum < totalPages;
    const hasPrev = pageNum > 1;

    // Return the found campaigns with pagination info
    return res.status(200).json({
      message: "Campaigns retrieved successfully.",
      success: true,
      data: normalizedCampaigns,
      pagination: {
        currentPage: pageNum,
        totalPages: totalPages,
        totalCampaigns: totalCampaigns,
        hasNext: hasNext,
        hasPrev: hasPrev,
        limit: limitNum
      }
    });
  } catch (error) {
    // Log the error for debugging purposes.
    console.error("Error retrieving user campaigns:", error.message);

    // Return a 500 status code for internal server errors.
    res.status(500).json({
      message: "An error occurred while retrieving campaigns.",
      success: false,
      error: error.message,
    });
  }
};
