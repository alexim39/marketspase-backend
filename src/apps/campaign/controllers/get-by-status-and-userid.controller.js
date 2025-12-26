
import { CampaignModel } from "../models/campaign.model.js";
import { UserModel } from "../../user/models/user.model.js";
import mongoose from "mongoose";

/**
 * Get campaigns by status (e.g., active, paused, completed, etc.) with pagination.
 * If no status is provided, returns active campaigns.
 * Campaigns are filtered based on user preferences if available.
 */
export const getCampaignsByStatusAndUserId = async (req, res) => {
  try {
    const {
      status,
      userId,
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // -------- Validation --------
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format.",
      });
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    if (!Number.isInteger(pageNum) || !Number.isInteger(limitNum) || pageNum < 1 || limitNum < 1) {
      return res.status(400).json({
        success: false,
        message: "Page and limit must be positive integers.",
      });
    }

    const skip = (pageNum - 1) * limitNum;

    // -------- User + preferences --------
    const user = await UserModel.findById(userId).select("preferences personalInfo");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // -------- Base query (status omitted => 'active') --------
    const baseQuery = {
      status: status ? String(status).trim().toLowerCase() : "active",
      isDeleted: { $ne: true },
    };

    // -------- Category target (DB-level) --------
    const enhancedQuery = { ...baseQuery };
    let userPreferencesUsed = false;

    if (user.preferences) {
      const { categoryBasedAds, adCategories } = user.preferences;

      if (categoryBasedAds && Array.isArray(adCategories) && adCategories.length > 0) {
        enhancedQuery.category = { $in: adCategories };
        userPreferencesUsed = true; // category preference actively influenced the query
      }
    }

    // -------- Age targeting with smart fallback --------
    // For users 18+, try ageTarget ∈ ['all', <group>]; if no matches, drop age filter.
    const userAge = calculateAge(user?.personalInfo?.dob);
    const userAgeGroup = getAgeGroup(userAge);
    const ageTargetingRequested = userAge !== null && userAge >= 18;

    let effectiveQuery = { ...enhancedQuery };
    if (ageTargetingRequested) {
      const ageQuery = { ...enhancedQuery, ageTarget: { $in: ["all", userAgeGroup] } };
      const ageMatchCount = await CampaignModel.countDocuments(ageQuery);

      if (ageMatchCount > 0) {
        effectiveQuery = ageQuery;
        // age targeting is effectively applied; we don't add extra flags to the response
        // to keep the exact response contract your frontend expects.
      } else {
        // Fallback: drop age filter (keep status/category constraints)
        effectiveQuery = enhancedQuery;
      }
    }

    // -------- Count for pagination metadata (DB-level filters only) --------
    const totalCampaignsCount = await CampaignModel.countDocuments(effectiveQuery);

    // -------- Fetch current page from DB --------
    const normalizedSortBy =
      ["createdAt", "priority"].includes(String(sortBy)) ? String(sortBy) : "createdAt";
    const normalizedSortOrder = String(sortOrder).toLowerCase() === "asc" ? 1 : -1;
    const dbSort = { [normalizedSortBy]: normalizedSortOrder };

    let campaigns = await CampaignModel.find(effectiveQuery)
      .sort(dbSort) // initial DB sort (will be refined after location scoring/priority)
      .skip(skip)
      .limit(limitNum)
      .populate({
        path: "owner",
        select: "displayName username email",
      })
      .exec();

    // If DB returned zero for this page window, stop here (maintain your current behavior)
    if (!campaigns || campaigns.length === 0) {
      return res.status(404).json({
        success: false,
        message: status
          ? `No campaigns found with status "${status}".`
          : "No campaigns found.",
      });
    }

    // -------- In-memory location filtering with granular priority --------
    // Priority order: street (4) > city (3) > state (2) > country (1)
    let filteredCampaigns = [...campaigns];

    if (user.preferences && user.preferences.locationBasedAds) {
      const { street, city, state, country } = extractUserLocation(user);
      const hasAnyUserLocation = street || city || state || country;

      if (hasAnyUserLocation) {
        const withScores = campaigns.map((c) => ({
          campaign: c,
          score: locationMatchScore(c, { street, city, state, country }),
        }));

        // Keep only those with a positive score
        const matched = withScores.filter((x) => x.score > 0);

        if (matched.length > 0) {
          // Sort primarily by location granularity, then by priority, then createdAt
          matched.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;

            const priorityOrder = { high: 3, medium: 2, low: 1 };
            const aPri = priorityOrder[a.campaign.priority] ?? 1;
            const bPri = priorityOrder[b.campaign.priority] ?? 1;
            if (bPri !== aPri) return bPri - aPri;

            return new Date(b.campaign.createdAt) - new Date(a.campaign.createdAt);
          });

          filteredCampaigns = matched.map((x) => x.campaign);
          userPreferencesUsed = true; // location preference influenced the result set
        } else {
          // Respect the user's location preference strictly (no fallback to unfiltered)
          filteredCampaigns = [];
          console.log(
            "No campaigns match user location preferences in this page. Respecting preference."
          );
        }
      }
      // If no address available and preference is ON, we keep campaigns as-is
      // (maintains parity with your current behavior).
    }

    // -------- Optional random selection when both category & location OFF --------
    if (
      user.preferences &&
      !user.preferences.categoryBasedAds &&
      !user.preferences.locationBasedAds
    ) {
      if (filteredCampaigns.length > 10) {
        filteredCampaigns = getRandomCampaigns(filteredCampaigns, 10);
      }
    }

    // -------- Final sort (maintain your pattern) --------
    // If location preference is ON and we computed scores, we've already sorted by score, then priority, then createdAt.
    // Otherwise, sort by priority, then createdAt (desc) to keep your current behavior consistent.
    if (!user.preferences?.locationBasedAds) {
      filteredCampaigns.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const priorityDiff = (priorityOrder[b.priority] ?? 1) - (priorityOrder[a.priority] ?? 1);
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
    }

    // -------- Pagination metadata (DB-level counts) --------
    const totalPages = Math.ceil(totalCampaignsCount / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    console.log(
      `Pagination: Page ${pageNum}, Showing ${filteredCampaigns.length} of ${totalCampaignsCount} total campaigns`
    );
    console.log(`Database query returned: ${campaigns.length} campaigns`);

    // -------- Response (exact same shape as your working code) --------
    return res.status(200).json({
      success: true,
      data: filteredCampaigns,
      message: status
        ? `Campaigns with status "${status}" fetched successfully.`
        : "Campaigns fetched successfully based on your preferences.",
      metadata: {
        pagination: {
          currentPage: pageNum,
          totalPages: totalPages,
          totalFilteredCampaigns: filteredCampaigns.length,
          totalAllCampaigns: totalCampaignsCount,
          campaignsPerPage: limitNum,
          hasNextPage,
          hasPrevPage,
          nextPage: hasNextPage ? pageNum + 1 : null,
          prevPage: hasPrevPage ? pageNum - 1 : null,
        },
        userPreferencesUsed,
      },
    });
  } catch (error) {
    console.error("Error fetching campaigns by status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch campaigns.",
      error: error.message,
    });
  }
};

/** ----------------- Helpers (kept local to avoid disruption) ----------------- **/

function getRandomCampaigns(campaigns, maxCount) {
  if (campaigns.length <= maxCount) return [...campaigns];
  const shuffled = [...campaigns].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, maxCount);
}

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
  if (age === null || age < 18) return "all";
  if (age >= 18 && age <= 24) return "young";
  if (age >= 25 && age <= 44) return "middle";
  if (age >= 45) return "advanced";
  return "all";
}

function extractUserLocation(user) {
  const addr = user?.personalInfo?.address || {};
  const norm = (v) => (typeof v === "string" ? v.trim().toLowerCase() : "");
  return {
    street: norm(addr.street),
    city: norm(addr.city),
    state: norm(addr.state),
    country: norm(addr.country),
  };
}

// 4 = street, 3 = city, 2 = state, 1 = country, 0 = no match
function locationMatchScore(campaign, userLoc) {
  const toStr = (v) => (v ?? "").toString().trim().toLowerCase();
  const street = userLoc.street;
  const city = userLoc.city;
  const state = userLoc.state;
  const country = userLoc.country;

  if (!Array.isArray(campaign.targetLocations) || campaign.targetLocations.length === 0) return 0;

  let best = 0;
  for (const loc of campaign.targetLocations) {
    const name = toStr(loc?.name);
    const locCity = toStr(loc?.city);
    const locState = toStr(loc?.state);
    const locCountry = toStr(loc?.country);

    if (street && (name.includes(street) || locCity.includes(street))) {
      best = Math.max(best, 4);
      break; // cannot beat street match
    }
    if (city && (name.includes(city) || locCity.includes(city))) {
      best = Math.max(best, 3);
    }
    if (state && (name.includes(state) || locState.includes(state))) {
      best = Math.max(best, 2);
    }
    if (country && (name.includes(country) || locCountry.includes(country))) {
      best = Math.max(best, 1);
    }
  }
  return best;
}
