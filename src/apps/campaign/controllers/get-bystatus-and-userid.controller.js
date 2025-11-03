import { CampaignModel } from "../models/campaign.model.js";
import { UserModel } from "../../user/models/user.model.js";
import mongoose from "mongoose";

/**
 * Get campaigns by status (e.g., active, paused, completed, etc.) with pagination.
 * If no status is provided, returns all campaigns.
 * Campaigns are filtered based on user preferences if available.
 */
export const getCampaignsByStatusAndUserId = async (req, res) => {
  try {
    const { status, userId, page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    // Validate userId
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required.",
      });
    }

    // Validate if userId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format.",
      });
    }

    // Validate pagination parameters
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    if (pageNum < 1 || limitNum < 1) {
      return res.status(400).json({
        success: false,
        message: "Page and limit must be positive integers.",
      });
    }

    // Find user and their preferences
    const user = await UserModel.findById(userId).select('preferences personalInfo');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    let baseQuery = { status: "active", isDeleted: { $ne: true } }; // Default: active campaigns not deleted
    
    if (status) {
      baseQuery.status = status;
    }

    // Build enhanced query with preference filters at database level
    let enhancedQuery = { ...baseQuery };
    let userPreferencesUsed = false;

    if (user.preferences) {
      const { categoryBasedAds, locationBasedAds, adCategories } = user.preferences;
      //const userLocation = user.personalInfo?.address?.state || user.personalInfo?.address?.city;
      const userLocation = user.personalInfo?.address?.street || 
                    user.personalInfo?.address?.city || 
                    user.personalInfo?.address?.state || 
                    user.personalInfo?.address?.country;

      // console.log("User preferences:", {
      //   categoryBasedAds,
      //   locationBasedAds,
      //   adCategories,
      //   userLocation
      // });

      // Apply category filter at database level if enabled
      if (categoryBasedAds && adCategories && adCategories.length > 0) {
        enhancedQuery.category = { $in: adCategories.map(cat => new RegExp(cat, 'i')) };
        userPreferencesUsed = true;
      }

      // Note: Location filtering is complex and might need to be done in memory
      // since it involves checking array fields and partial matches
    }

    // Get total count for pagination metadata
    const totalCampaignsCount = await CampaignModel.countDocuments(enhancedQuery);

    // Get paginated campaigns from database with enhanced query
    let campaigns = await CampaignModel.find(enhancedQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate({
        path: "owner",
        select: "displayName username email",
      })
      .exec();

    if (!campaigns || campaigns.length === 0) {
      return res.status(404).json({
        success: false,
        message: status
          ? `No campaigns found with status "${status}".`
          : "No campaigns found.",
      });
    }

    // Apply location-based filtering in memory (if needed)
    let filteredCampaigns = [...campaigns];
    
    if (user.preferences && user.preferences.locationBasedAds) {
      //const userLocation = user.personalInfo?.address?.state || user.personalInfo?.address?.city;
      const userLocation = user.personalInfo?.address?.street || 
                    user.personalInfo?.address?.city || 
                    user.personalInfo?.address?.state || 
                    user.personalInfo?.address?.country;
      
      if (userLocation) {
        filteredCampaigns = campaigns.filter(campaign => {
          if (!campaign.targetLocations || campaign.targetLocations.length === 0) {
            return true; // If campaign has no location restrictions, include it
          }
          
          // return campaign.targetLocations.some(location =>
          //   location.toLowerCase().includes(userLocation.toLowerCase()) ||
          //   userLocation.toLowerCase().includes(location.toLowerCase())
          // );

          return campaign.targetLocations.some(location => {
            const targetStr = (location.name || location.city || '').toString().toLowerCase(); // Adjust property name as needed
            const userStr = userLocation.toLowerCase();
            return targetStr.includes(userStr) || userStr.includes(targetStr);
          });
        });
        
        if (filteredCampaigns.length === 0) {
          console.log("No campaigns match user location preferences in this page");
          // Fall back to original campaigns if location filtering removes all results
          filteredCampaigns = campaigns;
        } else {
          userPreferencesUsed = true;
        }
      }
    }

    // If both category and location preferences are disabled, we might want random selection
    if (user.preferences && !user.preferences.categoryBasedAds && !user.preferences.locationBasedAds) {
      // User has preferences but both are disabled - return random selection from paginated results
      if (filteredCampaigns.length > 10) { // Adjust this number as needed
        filteredCampaigns = getRandomCampaigns(filteredCampaigns, 10);
      }
    }

    // Sort by priority (high, medium, low) and then by creation date
    filteredCampaigns.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      
      if (priorityDiff !== 0) return priorityDiff;
      
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCampaignsCount / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    console.log(`Pagination: Page ${pageNum}, Showing ${filteredCampaigns.length} of ${totalCampaignsCount} total campaigns`);
    console.log(`Database query returned: ${campaigns.length} campaigns`);

    res.status(200).json({
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
          prevPage: hasPrevPage ? pageNum - 1 : null
        },
        userPreferencesUsed
      }
    });
  } catch (error) {
    console.error("Error fetching campaigns by status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch campaigns.",
      error: error.message,
    });
  }
};

/**
 * Helper function to get random campaigns from the array
 * @param {Array} campaigns - Array of campaigns
 * @param {number} maxCount - Maximum number of campaigns to return
 * @returns {Array} Randomly selected campaigns
 */
function getRandomCampaigns(campaigns, maxCount) {
  if (campaigns.length <= maxCount) {
    return [...campaigns];
  }

  // Shuffle array and take first maxCount elements
  const shuffled = [...campaigns].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, maxCount);
}