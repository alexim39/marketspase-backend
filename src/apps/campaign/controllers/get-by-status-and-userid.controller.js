import mongoose from "mongoose";
import { CampaignModel } from "../models/campaign.model.js";
import { UserModel } from "../../user/models/user/index.js";
import { refreshUserReputation } from "../../user/services/user-reputation.service.js";

const DEFAULT_COST_PER_CLICK = 80;
const CAMPAIGN_DISCOVERY_CACHE_TTL_MS = 60 * 1000;
const REPUTATION_STALE_MS = 15 * 60 * 1000;
const campaignDiscoveryCache = new Map();

/**
 * Promoter-facing campaign discovery with:
 * 1. marketer/promoter address alignment ranked first
 * 2. campaign targeting rules enforced when configured
 * 3. promoter ad preferences used as secondary relevance signals
 */
export const getCampaignsByStatusAndUserId = async (req, res) => {
  try {
    const {
      status,
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "desc",
      enforceTarget = "true",
      includeNonTargeted = "true",
    } = req.query;
    const userId = req.userId;

    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required." });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user ID format." });
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.max(parseInt(limit, 10) || 20, 1);
    const skip = (pageNum - 1) * limitNum;
    const normalizedStatus = status ? String(status).trim().toLowerCase() : "active";
    const normalizedSortOrder = String(sortOrder).toLowerCase() === "asc" ? 1 : -1;
    const shouldEnforceTarget = enforceTarget !== "false";
    const allowNonTargeted = includeNonTargeted !== "false";
    const cacheKey = JSON.stringify({
      userId,
      status: normalizedStatus,
      page: pageNum,
      limit: limitNum,
      sortBy: String(sortBy || "createdAt"),
      sortOrder: normalizedSortOrder,
      shouldEnforceTarget,
      allowNonTargeted,
    });
    const cachedResponse = campaignDiscoveryCache.get(cacheKey);
    if (cachedResponse && cachedResponse.expiresAt > Date.now()) {
      res.set("Cache-Control", "no-store");
      return res.status(200).json(cachedResponse.payload);
    }

    const user = await UserModel.findById(userId)
      .select("preferences personalInfo rating ratingCount ratingUpdatedAt tags role loginStreak gamificationProfile")
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const cachedRating = Number(user.rating);
    const cachedRatingCount = Number(user.ratingCount);
    const ratingUpdatedAt = user.ratingUpdatedAt ? new Date(user.ratingUpdatedAt) : null;
    const hasCachedReputation =
      Number.isFinite(cachedRating) &&
      Number.isFinite(cachedRatingCount) &&
      ratingUpdatedAt instanceof Date &&
      !Number.isNaN(ratingUpdatedAt.getTime());

    if (hasCachedReputation) {
      user.rating = cachedRating;
      user.ratingCount = cachedRatingCount;

      if ((Date.now() - ratingUpdatedAt.getTime()) > REPUTATION_STALE_MS) {
        setImmediate(() => {
          refreshUserReputation({
            _id: userId,
            role: user.role,
            loginStreak: user.loginStreak,
            gamificationProfile: user.gamificationProfile,
            rating: cachedRating,
            ratingCount: cachedRatingCount,
            ratingUpdatedAt,
          }).catch((error) => {
            console.warn("Unable to refresh promoter reputation during campaign discovery:", error.message);
          });
        });
      }
    } else {
      const reputationSnapshot = await refreshUserReputation({
        _id: userId,
        role: user.role,
        loginStreak: user.loginStreak,
        gamificationProfile: user.gamificationProfile,
      });

      user.rating = reputationSnapshot.rating;
      user.ratingCount = reputationSnapshot.ratingCount;
    }

    const userAddress = extractUserLocation(user);
    const hasUserAddress = Object.values(userAddress).some(Boolean);
    const userAge = calculateAge(user?.personalInfo?.dob);
    const userAgeGroup = getAgeGroup(userAge);
    const userRating = Number.isFinite(Number(user?.rating)) ? Number(user.rating) : null;
    const userTags = normalizeArrayStrings(user?.tags);
    const prefersCategories =
      Boolean(user?.preferences?.categoryBasedAds) &&
      Array.isArray(user?.preferences?.adCategories) &&
      user.preferences.adCategories.length > 0;
    const preferredCategories = normalizeArrayStrings(user?.preferences?.adCategories);

    const ownerAddressScoreExpr = buildOwnerAddressScoreExpr(userAddress);
    const targetLocationScoreExpr = buildTargetLocationScoreExpr(userAddress);
    const categoryPreferenceScoreExpr = prefersCategories
      ? {
          $cond: [
            { $in: [{ $toLower: { $ifNull: ["$category", "other"] } }, preferredCategories] },
            2,
            0,
          ],
        }
      : 0;

    const targetRequirementsEligibleExpr = buildRequirementsEligibleExpr(userTags);
    const remainingBudgetExpr = {
      $max: [
        {
          $subtract: [
            { $toDouble: { $ifNull: ["$budget", 0] } },
            { $toDouble: { $ifNull: ["$spentBudget", 0] } },
          ],
        },
        0,
      ],
    };

    const normalizedCostPerClickExpr = {
      $let: {
        vars: {
          costValue: {
            $toDouble: {
              $ifNull: ["$costPerClick", { $ifNull: ["$payoutPerPromotion", DEFAULT_COST_PER_CLICK] }],
            },
          },
        },
        in: {
          $cond: [{ $gt: ["$$costValue", 0] }, "$$costValue", DEFAULT_COST_PER_CLICK],
        },
      },
    };

    const notExpiredExpr = {
      $cond: [{ $ifNull: ["$endDate", false] }, { $gte: ["$endDate", new Date()] }, true],
    };

    const hasTargetLocationsExpr = {
      $gt: [{ $size: { $ifNull: ["$targetLocations", []] } }, 0],
    };

    const ageEligibleExpr =
      userAgeGroup === "all"
        ? true
        : {
            $in: [{ $ifNull: ["$ageTarget", "all"] }, ["all", userAgeGroup]],
          };

    const ratingEligibleExpr =
      userRating === null
        ? true
        : {
            $lte: [{ $ifNull: ["$minRating", 0] }, userRating],
          };

    const locationEligibleExpr = {
      $cond: [
        hasTargetLocationsExpr,
        hasUserAddress ? { $gt: [targetLocationScoreExpr, 0] } : false,
        true,
      ],
    };

    const campaignTargetEligibleExpr = shouldEnforceTarget
      ? {
          $cond: [
            { $eq: ["$enableTarget", true] },
            { $and: [ageEligibleExpr, ratingEligibleExpr, targetRequirementsEligibleExpr, locationEligibleExpr] },
            allowNonTargeted,
          ],
        }
      : true;

    const availabilityEligibleExpr = {
      $and: [
        { $gte: [remainingBudgetExpr, normalizedCostPerClickExpr] },
        notExpiredExpr,
      ],
    };

    const priorityWeightExpr = {
      $switch: {
        branches: [
          { case: { $eq: ["$priority", "high"] }, then: 3 },
          { case: { $eq: ["$priority", "medium"] }, then: 2 },
          { case: { $eq: ["$priority", "low"] }, then: 1 },
        ],
        default: 1,
      },
    };

    const sortStage =
      String(sortBy) === "priority"
        ? {
            ownerAddressScore: -1,
            categoryPreferenceScore: -1,
            targetLocationScore: -1,
            priorityWeight: normalizedSortOrder,
            createdAt: -1,
          }
        : {
            ownerAddressScore: -1,
            categoryPreferenceScore: -1,
            targetLocationScore: -1,
            createdAt: normalizedSortOrder,
            priorityWeight: -1,
          };

    const pipeline = [
      {
        $match: {
          status: normalizedStatus,
          isDeleted: { $ne: true },
        },
      },
      {
        $lookup: {
          from: UserModel.collection.name,
          localField: "owner",
          foreignField: "_id",
          as: "ownerDoc",
          pipeline: [
            {
              $project: {
                displayName: 1,
                username: 1,
                email: 1,
                personalInfo: 1,
              },
            },
          ],
        },
      },
      {
        $unwind: {
          path: "$ownerDoc",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          ownerAddressScore: ownerAddressScoreExpr,
          targetLocationScore: targetLocationScoreExpr,
          categoryPreferenceScore: categoryPreferenceScoreExpr,
          priorityWeight: priorityWeightExpr,
          remainingBudget: remainingBudgetExpr,
          normalizedCostPerClick: normalizedCostPerClickExpr,
          campaignTargetEligible: campaignTargetEligibleExpr,
          availabilityEligible: availabilityEligibleExpr,
        },
      },
      {
        $match: {
          campaignTargetEligible: true,
          availabilityEligible: true,
        },
      },
      {
        $sort: sortStage,
      },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limitNum },
            {
              $project: {
                _id: 1,
                title: 1,
                mediaUrl: 1,
                thumbnailUrl: 1,
                caption: 1,
                category: 1,
                mediaType: 1,
                budget: 1,
                costPerClick: "$normalizedCostPerClick",
                currency: 1,
                totalPromotions: 1,
                spentBudget: 1,
                endDate: 1,
                status: 1,
                createdAt: 1,
                totalClicks: 1,
                billableClicks: 1,
                remainingBudget: 1,
                canAcceptPromoters: "$availabilityEligible",
                ownerAddressScore: 1,
                targetLocationScore: 1,
                categoryPreferenceScore: 1,
                owner: {
                  _id: "$ownerDoc._id",
                  displayName: "$ownerDoc.displayName",
                  username: "$ownerDoc.username",
                  email: "$ownerDoc.email",
                },
                ownerAddress: {
                  city: "$ownerDoc.personalInfo.address.city",
                  state: "$ownerDoc.personalInfo.address.state",
                  country: "$ownerDoc.personalInfo.address.country",
                },
              },
            },
          ],
          totalCount: [{ $count: "count" }],
        },
      },
    ];

    const [aggregationResult] = await CampaignModel.aggregate(pipeline).allowDiskUse(true);
    const campaigns = aggregationResult?.data || [];
    const totalCampaignsCount = aggregationResult?.totalCount?.[0]?.count || 0;

    const finalCampaigns = campaigns.map((campaign) => {
      const ownerAddressMatchLevel = getOwnerAddressMatchLevel(Number(campaign.ownerAddressScore || 0));
      const marketerLocationSummary = buildOwnerLocationSummary(campaign.ownerAddress);
      const { ownerAddress, ...campaignWithoutOwnerAddress } = campaign;

      return {
        ...campaignWithoutOwnerAddress,
        remainingBudget: Math.max(Number(campaign.remainingBudget ?? 0), 0),
        costPerClick: Number(campaign.costPerClick ?? DEFAULT_COST_PER_CLICK),
        marketerLocationSummary,
        ownerAddressMatchLevel,
      };
    });

    if (finalCampaigns.length === 0) {
      const payload = {
        success: true,
        data: [],
        message: "No campaigns matched the current relevance and targeting rules.",
        metadata: {
          pagination: {
            currentPage: pageNum,
            totalPages: 0,
            totalFilteredCampaigns: 0,
            totalAllCampaigns: 0,
            campaignsPerPage: limitNum,
            hasNextPage: false,
            hasPrevPage: pageNum > 1,
            nextPage: null,
            prevPage: pageNum > 1 ? pageNum - 1 : null,
          },
          targeting: {
            enforced: shouldEnforceTarget,
            includeNonTargeted: allowNonTargeted,
            ownerAddressPriorityApplied: hasUserAddress,
            categoryPreferencesApplied: prefersCategories,
            userAddressAvailable: hasUserAddress,
          },
        },
      };

      campaignDiscoveryCache.set(cacheKey, {
        payload,
        expiresAt: Date.now() + CAMPAIGN_DISCOVERY_CACHE_TTL_MS,
      });

      res.set("Cache-Control", "no-store");
      return res.status(200).json(payload);
    }

    const totalPages = Math.ceil(totalCampaignsCount / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    const payload = {
      success: true,
      data: finalCampaigns,
      message: "Campaigns fetched successfully based on promoter relevance.",
      metadata: {
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalFilteredCampaigns: finalCampaigns.length,
          totalAllCampaigns: totalCampaignsCount,
          campaignsPerPage: limitNum,
          hasNextPage,
          hasPrevPage,
          nextPage: hasNextPage ? pageNum + 1 : null,
          prevPage: hasPrevPage ? pageNum - 1 : null,
        },
        targeting: {
          enforced: shouldEnforceTarget,
          includeNonTargeted: allowNonTargeted,
          ownerAddressPriorityApplied: hasUserAddress,
          categoryPreferencesApplied: prefersCategories,
          userAddressAvailable: hasUserAddress,
        },
      },
    };

    campaignDiscoveryCache.set(cacheKey, {
      payload,
      expiresAt: Date.now() + CAMPAIGN_DISCOVERY_CACHE_TTL_MS,
    });

    res.set("Cache-Control", "no-store");
    return res.status(200).json(payload);
  } catch (error) {
    console.error("Error fetching campaigns by status (promoter relevance):", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch campaigns.",
      error: error.message,
    });
  }
};

function calculateAge(dob) {
  if (!dob) return null;

  try {
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age;
  } catch {
    return null;
  }
}

function getAgeGroup(age) {
  if (age === null) return "all";
  if (age < 18) return "all";
  if (age <= 24) return "young";
  if (age <= 44) return "middle";
  return "advanced";
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeArrayStrings(values) {
  return Array.isArray(values)
    ? values
        .map((value) => normalizeString(value))
        .filter(Boolean)
    : [];
}

function extractUserLocation(user) {
  const address = user?.personalInfo?.address ?? {};

  return {
    street: normalizeString(address.street),
    city: normalizeString(address.city),
    state: normalizeString(address.state),
    country: normalizeString(address.country),
  };
}

function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildOwnerAddressScoreExpr(userAddress) {
  const branches = [];

  if (userAddress.street) {
    branches.push({
      case: {
        $eq: [
          { $toLower: { $ifNull: ["$ownerDoc.personalInfo.address.street", ""] } },
          userAddress.street,
        ],
      },
      then: 5,
    });
  }

  if (userAddress.city) {
    branches.push({
      case: {
        $eq: [
          { $toLower: { $ifNull: ["$ownerDoc.personalInfo.address.city", ""] } },
          userAddress.city,
        ],
      },
      then: 4,
    });
  }

  if (userAddress.state) {
    branches.push({
      case: {
        $eq: [
          { $toLower: { $ifNull: ["$ownerDoc.personalInfo.address.state", ""] } },
          userAddress.state,
        ],
      },
      then: 3,
    });
  }

  if (userAddress.country) {
    branches.push({
      case: {
        $eq: [
          { $toLower: { $ifNull: ["$ownerDoc.personalInfo.address.country", ""] } },
          userAddress.country,
        ],
      },
      then: 2,
    });
  }

  if (branches.length === 0) {
    return 0;
  }

  return {
    $switch: {
      branches,
      default: 0,
    },
  };
}

function buildAnyTargetLocationMatchExpr(term) {
  const safePattern = escapeRegex(term);

  return {
    $anyElementTrue: {
      $map: {
        input: { $ifNull: ["$targetLocations", []] },
        as: "targetLocation",
        in: {
          $regexMatch: {
            input: { $toLower: { $ifNull: ["$$targetLocation.name", ""] } },
            regex: safePattern,
          },
        },
      },
    },
  };
}

function buildTargetLocationScoreExpr(userAddress) {
  const branches = [];

  if (userAddress.street) {
    branches.push({
      case: buildAnyTargetLocationMatchExpr(userAddress.street),
      then: 4,
    });
  }

  if (userAddress.city) {
    branches.push({
      case: buildAnyTargetLocationMatchExpr(userAddress.city),
      then: 3,
    });
  }

  if (userAddress.state) {
    branches.push({
      case: buildAnyTargetLocationMatchExpr(userAddress.state),
      then: 2,
    });
  }

  if (userAddress.country) {
    branches.push({
      case: buildAnyTargetLocationMatchExpr(userAddress.country),
      then: 1,
    });
  }

  if (branches.length === 0) {
    return 0;
  }

  return {
    $switch: {
      branches,
      default: 0,
    },
  };
}

function buildRequirementsEligibleExpr(userTags) {
  const requirementsExpr = { $ifNull: ["$requirements", []] };
  const requirementsCountExpr = { $size: requirementsExpr };

  if (userTags.length === 0) {
    return {
      $cond: [{ $gt: [requirementsCountExpr, 0] }, false, true],
    };
  }

  return {
    $cond: [
      { $gt: [requirementsCountExpr, 0] },
      {
        $eq: [
          { $size: { $setIntersection: [requirementsExpr, userTags] } },
          requirementsCountExpr,
        ],
      },
      true,
    ],
  };
}

function buildOwnerLocationSummary(ownerAddress) {
  if (!ownerAddress || typeof ownerAddress !== "object") {
    return null;
  }

  const city = normalizeString(ownerAddress.city);
  const state = normalizeString(ownerAddress.state);
  const country = normalizeString(ownerAddress.country);
  const segments = [city, state, country].filter(Boolean);

  if (segments.length === 0) {
    return null;
  }

  return segments
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(", ");
}

function getOwnerAddressMatchLevel(score) {
  if (score >= 5) return "street";
  if (score >= 4) return "city";
  if (score >= 3) return "state";
  if (score >= 2) return "country";
  return "none";
}
