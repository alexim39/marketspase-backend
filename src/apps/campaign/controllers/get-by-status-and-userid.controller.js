
import { CampaignModel } from "../models/campaign.model.js";
import { UserModel } from "../../user/models/user/index.js";
import mongoose from "mongoose";
import { refreshUserReputation } from "../../user/services/user-reputation.service.js";

/**
 * Strictly targeted campaigns by status & userId with pagination.
 * - status omitted => 'active'
 * - applies strict targeting only to campaigns with enableTarget = true
 * - ageTarget: exact enforcement (no fallback), 'all' always allowed
 * - location: DB-level filter via regex on targetLocations.name
 * - minRating: campaign.minRating <= user.rating
 * - requirements: campaign.requirements ⊆ userTags (subset check via $expr)
 */
export const getCampaignsByStatusAndUserId = async (req, res) => {
  try {
    const {
      status,
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "desc",
      // ---- Strict defaults ----
      enforceTarget = "true",          // require enableTarget branch
      includeNonTargeted = "false",    // STRICT by default; caller can opt-in
    } = req.query;
    const userId = req.userId;

    // ---- Validation ----
    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required." });
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user ID format." });
    }
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    if (!Number.isInteger(pageNum) || !Number.isInteger(limitNum) || pageNum < 1 || limitNum < 1) {
      return res.status(400).json({ success: false, message: "Page and limit must be positive integers." });
    }
    const skip = (pageNum - 1) * limitNum;

    // ---- User + essentials ----
    const user = await UserModel.findById(userId)
      .select("preferences personalInfo rating tags role loginStreak gamificationProfile")
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const reputationSnapshot = await refreshUserReputation({
      _id: userId,
      role: user.role,
      loginStreak: user.loginStreak,
      gamificationProfile: user.gamificationProfile,
    });
    user.rating = reputationSnapshot.rating;
    user.ratingCount = reputationSnapshot.ratingCount;

    // Normalize sort
    const normalizedSortBy = ["createdAt", "priority"].includes(String(sortBy)) ? String(sortBy) : "createdAt";
    const normalizedSortOrder = String(sortOrder).toLowerCase() === "asc" ? 1 : -1;
    const dbSort = { [normalizedSortBy]: normalizedSortOrder };

    // ---- Base query ----
    const baseQuery = {
      status: status ? String(status).trim().toLowerCase() : "active",
      isDeleted: { $ne: true },
    };

    // ---- Category preference (DB-level) ----
    const enhancedQuery = { ...baseQuery };
    if (user.preferences?.categoryBasedAds && Array.isArray(user.preferences?.adCategories) && user.preferences.adCategories.length > 0) {
      enhancedQuery.category = { $in: user.preferences.adCategories };
    }

    // ---- Targeting block (STRICT) ----
    const shouldEnforceTarget = enforceTarget === "true";
    const allowNonTargeted = includeNonTargeted === "true";

    // We build two branches and then $or them if includeNonTargeted=true:
    // 1) targetedBranch: enableTarget=true & strict constraints
    // 2) nonTargetedBranch: enableTarget=false (no constraints except base/enhanced)
    const orBranches = [];

    // --- Helper: age group ---
    const userAge = calculateAge(user?.personalInfo?.dob);
    const userAgeGroup = getAgeGroup(userAge); // 'young' | 'middle' | 'advanced' | 'all'

    // --- Helper: rating ---
    const userRating = Number.isFinite(Number(user?.rating)) ? Number(user.rating) : null;

    // --- Helper: requirements subset ---
    const userTags = Array.isArray(user?.tags)
      ? user.tags
      : Array.isArray(user?.preferences?.userTags)
      ? user.preferences.userTags
      : [];
    const hasUserTags = Array.isArray(userTags) && userTags.length > 0;

    // --- Helper: location terms from user address ---
    const { street, city, state, country } = extractUserLocation(user);
    const locationTerms = [street, city, state, country].filter(Boolean);
    const wantsLocationTargeting = !!user.preferences?.locationBasedAds;

    // STRICT: if the user insists on location targeting but has no address,
    // we should not return campaigns (because we cannot validate location).
    if (shouldEnforceTarget && wantsLocationTargeting && locationTerms.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        message: "No campaigns match user location preferences (user has no address).",
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
            ageTargetApplied: userAge !== null,
            locationTargetApplied: false,
            minRatingApplied: userRating !== null,
            requirementsApplied: hasUserTags,
          },
        },
      });
    }

    // 1) Targeted campaigns branch
    if (shouldEnforceTarget) {
      const targetedQuery = { ...enhancedQuery, enableTarget: true };

      // Age targeting (STRICT, no fallback)
      // - if age is unknown: do NOT add ageTarget filter (cannot validate)
      // - if < 18: only 'all' matches
      // - if >= 18: ['all', userAgeGroup] matches
      if (userAge !== null) {
        targetedQuery.ageTarget = userAge < 18
          ? { $in: ["all"] }
          : { $in: ["all", userAgeGroup] };
      }

      // Min rating (campaign.minRating <= userRating)
      if (userRating !== null) {
        targetedQuery.minRating = { $lte: userRating };
      }

      // Requirements: campaign.requirements ⊆ userTags (only if we know the user's tags)
      if (hasUserTags) {
        targetedQuery.$expr = {
          $eq: [
            { $size: { $setIntersection: ["$requirements", userTags] } },
            { $size: "$requirements" }
          ]
        };
      }

      // Location targeting (DB-level) – if user wants it and has address terms
      if (wantsLocationTargeting && locationTerms.length > 0) {
        targetedQuery["targetLocations.name"] = { $in: locationTerms.map(t => new RegExp(escapeRegex(t), "i")) };
      }

      orBranches.push(targetedQuery);
    }

    // 2) Non-targeted campaigns branch (opt-in only)
    if (allowNonTargeted) {
      const nonTargetedQuery = { ...enhancedQuery, enableTarget: false };
      // No age/location/minRating/requirements constraints here by design.
      orBranches.push(nonTargetedQuery);
    }

    // Final effective query
    let effectiveQuery;
    if (orBranches.length === 0) {
      // Safety: if both toggles were off, default to targeted
      effectiveQuery = { ...enhancedQuery, enableTarget: true };
    } else if (orBranches.length === 1) {
      effectiveQuery = orBranches[0];
    } else {
      effectiveQuery = { $or: orBranches };
    }

    // ---- Count for pagination (DB-level) ----
    const totalCampaignsCount = await CampaignModel.countDocuments(effectiveQuery);

    // ---- Fetch current page (lean + projection) ----
    const projection = {
      title: 1,
      mediaUrl: 1,
      thumbnailUrl: 1,
      caption: 1,
      link: 1,
      category: 1,
      mediaType: 1,
      budget: 1,
      payoutPerPromotion: 1,
      currency: 1,
      maxPromoters: 1,
      currentPromoters: 1,
      minViewsPerPromotion: 1,
      totalPromotions: 1,
      validatedPromotions: 1,
      paidPromotions: 1,
      spentBudget: 1,
      enableTarget: 1,
      ageTarget: 1,
      targetLocations: 1,
      requirements: 1,
      minRating: 1,
      campaignType: 1,
      priority: 1,
      startDate: 1,
      endDate: 1,
      hasEndDate: 1,
      status: 1,
      isDeleted: 1,
      createdAt: 1,
      updatedAt: 1,
    };

    let campaigns = await CampaignModel.find(effectiveQuery, projection)
      .sort(dbSort)
      .skip(skip)
      .limit(limitNum)
      .populate({ path: "owner", select: "displayName username email" })
      .lean()
      .exec();

    if (!campaigns || campaigns.length === 0) {
      return res.status(404).json({
        success: false,
        message: status
          ? `No campaigns found with status "${status}".`
          : "No campaigns found.",
      });
    }

    // ---- Optional in-memory location scoring (for ranking only) ----
    // We already DB-filtered if location targeting was requested;
    // scoring just refines ordering by granularity.
    let finalCampaigns = campaigns;
    if (wantsLocationTargeting && locationTerms.length > 0) {
      const withScores = campaigns.map((c) => ({
        campaign: c,
        score: locationMatchScoreUsingNameOnly(c, { street, city, state, country }),
      }));
      withScores.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const aPri = priorityOrder[a.campaign.priority] ?? 1;
        const bPri = priorityOrder[b.campaign.priority] ?? 1;
        if (bPri !== aPri) return bPri - aPri;
        return new Date(b.campaign.createdAt) - new Date(a.campaign.createdAt);
      });
      finalCampaigns = withScores.map((x) => x.campaign);
    } else if (!wantsLocationTargeting) {
      // Default sort refinement (priority desc, then createdAt desc)
      finalCampaigns.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const priorityDiff = (priorityOrder[b.priority] ?? 1) - (priorityOrder[a.priority] ?? 1);
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
    }

    // ---- Pagination metadata ----
    const totalPages = Math.ceil(totalCampaignsCount / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    // ---- Response ----
    return res.status(200).json({
      success: true,
      data: finalCampaigns,
      message: status
        ? `Campaigns with status "${status}" fetched successfully.`
        : "Campaigns fetched successfully based on strict targeting.",
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
          ageTargetApplied: userAge !== null,
          locationTargetApplied: wantsLocationTargeting && locationTerms.length > 0,
          minRatingApplied: userRating !== null,
          requirementsApplied: hasUserTags,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching campaigns by status (strict targeting):", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch campaigns.",
      error: error.message,
    });
  }
};

/* ------------------------- Helpers ------------------------- */

function calculateAge(dob) {
  if (!dob) return null;
  try {
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
  } catch {
    return null;
  }
}

function getAgeGroup(age) {
  if (age === null) return "all";
  if (age < 18) return "all";
  if (age >= 18 && age <= 24) return "young";
  if (age >= 25 && age <= 44) return "middle";
  if (age >= 45) return "advanced";
  return "all";
}

function extractUserLocation(user) {
  const addr = user?.personalInfo?.address ?? {};
  const norm = (v) => (typeof v === "string" ? v.trim().toLowerCase() : "");
  return {
    street: norm(addr.street),
    city: norm(addr.city),
    state: norm(addr.state),
    country: norm(addr.country),
  };
}

function escapeRegex(text) {
  // Standard, safe escaping for user-provided strings
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Score: 4=street, 3=city, 2=state, 1=country, 0=no match
// We only have targetLocations.name in the model, so match all against that.
function locationMatchScoreUsingNameOnly(campaign, userLoc) {
  const toStr = (v) => (v ?? "").toString().trim().toLowerCase();
  if (!Array.isArray(campaign.targetLocations) || campaign.targetLocations.length === 0) return 0;
  let best = 0;
  const street = toStr(userLoc.street);
  const city = toStr(userLoc.city);
  const state = toStr(userLoc.state);
  const country = toStr(userLoc.country);
  for (const loc of campaign.targetLocations) {
    const name = toStr(loc?.name);
    if (street && name.includes(street)) { best = Math.max(best, 4); break; }
    if (city && name.includes(city)) { best = Math.max(best, 3); }
    if (state && name.includes(state)) { best = Math.max(best, 2); }
    if (country && name.includes(country)) { best = Math.max(best, 1); }
  }
  return best;
}
