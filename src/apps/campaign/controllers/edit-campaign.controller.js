import { CampaignModel } from "../models/campaign.model.js";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";

/**
 * @description Update an existing campaign
 * @param {object} req - The request object
 * @param {object} res - The response object
 * @returns {Promise<void>}
 */
export const EditCampaign = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { campaignId, performedBy } = req.params;
    const {
      title,
      caption,
      category,
      link,
      campaignType,
      enableTarget,
      startDate,
      endDate,
      hasEndDate,
      requirements,
      minRating,
      priority,
      targetLocations,
    } = req.body;

    // Validate required fields
    if (!campaignId || !title || !category) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Campaign ID, title, and category are required.",
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

    // Process requirements
    const requirementsArray = Array.isArray(requirements)
      ? requirements
      : typeof requirements === "string"
      ? requirements.split(",").map((req) => req.trim()).filter(Boolean)
      : campaign.requirements;

    // Process target locations
    const targetLocationsArray = Array.isArray(targetLocations)
      ? targetLocations
      : typeof targetLocations === "string"
      ? targetLocations.split(",").map((loc) => loc.trim())
      : campaign.targetLocations || [];

    // Update campaign fields
    campaign.title = title;
    campaign.caption = caption || "";
    campaign.category = category;
    campaign.link = link || "";
    campaign.campaignType = campaignType || "standard";
    campaign.enableTarget = Boolean(enableTarget);
    campaign.targetLocations = targetLocationsArray;
    campaign.requirements = requirementsArray;
    campaign.minRating = Number(minRating) || 0;
    campaign.priority = priority || "medium";
    campaign.hasEndDate = Boolean(hasEndDate);

    // Handle dates
    if (startDate) {
      campaign.startDate = new Date(startDate);
    }
    if (endDate && hasEndDate) {
      campaign.endDate = new Date(endDate);
    } else if (!hasEndDate) {
      campaign.endDate = undefined;
    }

    // Update activity log
    campaign.activityLog.push({
      action: "Campaign Updated",
      details: "Campaign details were modified",
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
      message: "Campaign updated successfully.",
      data: {
        _id: campaign._id,
        title: campaign.title,
        status: campaign.status,
        budget: campaign.budget,
        spentBudget: campaign.spentBudget,
        remainingBudget: campaign.remainingBudget,
        maxPromoters: campaign.maxPromoters,
        currentPromoters: campaign.currentPromoters,
      },
    });
  } catch (error) {
    // Rollback transaction on error
    await session.abortTransaction();
    session.endSession();

    console.error("Error updating campaign:", error);

    res.status(500).json({
      success: false,
      message: "An error occurred while updating the campaign.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};