import { CampaignModel } from "../models/campaign.model.js";
import { PromotionModel } from "../models/promotion.model.js";
import { UserModel } from "../../user/models/user.model.js";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";

/**
 * Get campaigns by status (e.g., active, paused, completed, etc.).
 * If no status is provided, returns all campaigns.
 * Campaigns are filtered based on user preferences if available.
 */
export const getCampaignsByStatusAndUserId = async (req, res) => {
  try {
    const { status, userId } = req.query;

    console.log("Received query parameters:", req.query);

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

    // Find user and their preferences
    const user = await UserModel.findById(userId).select('preferences personalInfo');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    let query = { status: "active", isDeleted: { $ne: true } }; // Default: active campaigns not deleted
    
    if (status) {
      query.status = status;
    }

    // Get all campaigns matching the status
    let campaigns = await CampaignModel.find(query).sort({ createdAt: -1 });

    // // Get all campaigns matching the status and populate the promoter object
    // let campaigns = await CampaignModel.find(query)
    //   .sort({ createdAt: -1 })
    //   .populate({
    //     path: "promoter", // Assuming the `promoter` field exists in the Campaign model
    //     model: "User", // Replace "User" with the correct model name for promoters
    //     select: "name email profilePicture", // Select only the fields you need
    //   });

    if (!campaigns || campaigns.length === 0) {
      return res.status(404).json({
        success: false,
        message: status
          ? `No campaigns found with status "${status}".`
          : "No campaigns found.",
      });
    }

    // Filter campaigns based on user preferences
    let filteredCampaigns = [];
    
    if (user.preferences) {
      const { categoryBasedAds, locationBasedAds, adCategories } = user.preferences;
      const userLocation = user.personalInfo?.address?.state || user.personalInfo?.address?.city;

      console.log("User preferences:", {
        categoryBasedAds,
        locationBasedAds,
        adCategories,
        userLocation
      });

      // If user has no preference settings or both are false, return random campaigns
      if (!categoryBasedAds && !locationBasedAds) {
        filteredCampaigns = getRandomCampaigns(campaigns, 50); // Get up to 50 random campaigns
      } else {
        // Filter campaigns based on preferences
        filteredCampaigns = campaigns.filter(campaign => {
          let matchesPreference = false;
          let matchesCategory = false;
          let matchesLocation = false;

          // Category matching
          if (categoryBasedAds && adCategories && adCategories.length > 0) {
            matchesCategory = adCategories.some(category => 
              campaign.category.toLowerCase().includes(category.toLowerCase()) ||
              category.toLowerCase().includes(campaign.category.toLowerCase())
            );
          }

          // Location matching
          if (locationBasedAds && userLocation && campaign.targetLocations && campaign.targetLocations.length > 0) {
            matchesLocation = campaign.targetLocations.some(location =>
              location.toLowerCase().includes(userLocation.toLowerCase()) ||
              userLocation.toLowerCase().includes(location.toLowerCase())
            );
          }

          // Determine if campaign matches preferences
          if (categoryBasedAds && locationBasedAds) {
            // User wants both category AND location matching
            matchesPreference = matchesCategory && matchesLocation;
          } else if (categoryBasedAds) {
            // User only wants category matching
            matchesPreference = matchesCategory;
          } else if (locationBasedAds) {
            // User only wants location matching
            matchesPreference = matchesLocation;
          }

          return matchesPreference;
        });

        // If no campaigns match preferences, fall back to random campaigns
        if (filteredCampaigns.length === 0) {
          console.log("No campaigns match user preferences, falling back to random selection");
          filteredCampaigns = getRandomCampaigns(campaigns, 30); // Get fewer random campaigns
        }
      }
    } else {
      // No preferences found, return random campaigns
      filteredCampaigns = getRandomCampaigns(campaigns, 50);
    }

    // If we still have no campaigns after filtering, return the original campaigns
    if (filteredCampaigns.length === 0) {
      filteredCampaigns = campaigns;
    }

    // Sort by priority (high, medium, low) and then by creation date
    filteredCampaigns.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      
      if (priorityDiff !== 0) return priorityDiff;
      
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    console.log(`Filtered ${filteredCampaigns.length} campaigns from ${campaigns.length} total campaigns`);

    res.status(200).json({
      success: true,
      data: filteredCampaigns,
      message: status
        ? `Campaigns with status "${status}" fetched successfully.`
        : "Campaigns fetched successfully based on your preferences.",
      metadata: {
        totalCampaigns: campaigns.length,
        filteredCampaigns: filteredCampaigns.length,
        userPreferencesUsed: user.preferences ? true : false
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
    return [...campaigns]; // Return all campaigns if we have less than maxCount
  }

  // Shuffle array and take first maxCount elements
  const shuffled = [...campaigns].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, maxCount);
}