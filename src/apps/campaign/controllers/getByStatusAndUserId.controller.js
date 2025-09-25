import { CampaignModel } from "../models/campaign.model.js";
import { PromotionModel } from "../models/promotion.model.js";
import { UserModel } from "../../user/models/user.model.js";
import mongoose from "mongoose";
import fs from "fs"; // Add this import
import path from "path"; // Useful for path operations



/**
 * Get campaigns by status (e.g., active, paused, completed, etc.).
 * If no status is provided, returns all campaigns.
 */
export const getCampaignsByStatusAndUserId = async (req, res) => {
  try {
    const { status, userId } = req.query;

    console.log("Received query parameters:", req.query);

    let query = {};
    if (status) {
      query.status = status;
    }

    const campaigns = await CampaignModel.find(query).sort({ createdAt: -1 });

    if (!campaigns || campaigns.length === 0) {
      return res.status(404).json({
        success: false,
        message: status
          ? `No campaigns found with status "${status}".`
          : "No campaigns found.",
      });
    }

    res.status(200).json({
      success: true,
      data: campaigns,
      message: status
        ? `Campaigns with status "${status}" fetched successfully.`
        : "All campaigns fetched successfully.",
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
