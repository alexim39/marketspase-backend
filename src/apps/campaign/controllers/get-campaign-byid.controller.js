import mongoose from "mongoose"; // ADD THIS IMPORT
import { CampaignModel } from "../models/campaign.model.js";

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
        populate: {
          path: "promoter",
          select: "-password",
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
      data: campaign,
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