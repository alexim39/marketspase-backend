import { CampaignModel } from "../models/campaign.model.js";
import mongoose from "mongoose";

/**
 * @description Update campaign targeting settings only
 * @param {object} req - The request object
 * @param {object} res - The response object
 * @returns {Promise<void>}
 */
export const UpdateCampaignTargeting = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { campaignId, performedBy } = req.params;
    const { enableTarget, targetLocations } = req.body;

    // Validate required fields
    if (!campaignId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Campaign ID is required.",
      });
    }

    // Find the campaign
    const campaign = await CampaignModel.findById(campaignId).session(session);
    if (!campaign) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Campaign not found.",
      });
    }

    // Check user permissions
    if (
      campaign.owner.toString() !== performedBy?.toString() &&
      req.user?.role !== "admin"
    ) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update this campaign.",
      });
    }

    // Validate targetLocations if provided
    let targetLocationsArray = campaign.targetLocations || [];
    
    if (enableTarget !== undefined) {
      campaign.enableTarget = Boolean(enableTarget);
    }

    // Process target locations if provided
    if (targetLocations !== undefined) {
      if (Array.isArray(targetLocations)) {
        targetLocationsArray = targetLocations.map(location => {
          // If it's already an object with the expected structure, use it as-is
          if (typeof location === 'object' && location !== null) {
            return {
              id: location.id || this.generateId(),
              name: location.name || '',
              type: location.type || 'place',
              place_id: location.place_id || '',
              coordinates: {
                lat: location.coordinates?.lat || 0,
                lng: location.coordinates?.lng || 0
              },
              precision: location.precision || 'medium'
            };
          }
          return null;
        }).filter(Boolean); // Remove any null values
      } else if (targetLocations === null || targetLocations === "") {
        // Clear targeting if explicitly set to empty
        targetLocationsArray = [];
      }
      // If targetLocations is provided but not an array, keep existing
    }

    // Update campaign targeting fields
    campaign.targetLocations = targetLocationsArray;

    // Update activity log
    campaign.activityLog.push({
      action: "Targeting Updated",
      details: `Campaign targeting settings were modified. Enable Target: ${campaign.enableTarget}, Locations: ${targetLocationsArray.length}`,
      timestamp: new Date(),
      performedBy,
    });

    // Update updatedBy field
    campaign.updatedBy = performedBy;

    // Save the updated campaign
    await campaign.save({ session });

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: "Campaign targeting updated successfully.",
      data: {
        _id: campaign._id,
        enableTarget: campaign.enableTarget,
        targetLocations: campaign.targetLocations,
        updatedAt: campaign.updatedAt,
      },
    });
  } catch (error) {
    // Rollback transaction on error
    await session.abortTransaction();
    session.endSession();

    console.error("Error updating campaign targeting:", error);

    res.status(500).json({
      success: false,
      message: "An error occurred while updating campaign targeting.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @description Get campaign targeting settings
 * @param {object} req - The request object
 * @param {object} res - The response object
 * @returns {Promise<void>}
 */
export const GetCampaignTargeting = async (req, res) => {
  try {
    const { campaignId } = req.params;

    // Validate required fields
    if (!campaignId) {
      return res.status(400).json({
        success: false,
        message: "Campaign ID is required.",
      });
    }

    // Find the campaign with only targeting fields
    const campaign = await CampaignModel.findById(campaignId)
      .select("enableTarget targetLocations owner status")
      .lean();

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found.",
      });
    }

    // Check user permissions
    const userId = req.user?._id || req.query.userId;
    if (
      campaign.owner.toString() !== userId?.toString() &&
      req.user?.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this campaign targeting.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Campaign targeting retrieved successfully.",
      data: {
        _id: campaign._id,
        enableTarget: campaign.enableTarget,
        targetLocations: campaign.targetLocations || [],
        status: campaign.status,
      },
    });
  } catch (error) {
    console.error("Error fetching campaign targeting:", error);

    res.status(500).json({
      success: false,
      message: "An error occurred while fetching campaign targeting.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Helper function to generate IDs for new locations
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}