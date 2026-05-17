import mongoose from "mongoose";
import { ensureSelfOrAdmin, getAuthenticatedUserId } from "../../../shared/utils/request-auth.util.js";
import { getPromoterAnalyticsSnapshot } from "../../campaign/services/campaign-analytics.service.js";

export const getPromoterAnalytics = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid promoter ID.",
      });
    }

    if (!getAuthenticatedUserId(req)) {
      return res.status(401).json({
        success: false,
        message: "Authentication is required.",
      });
    }

    if (!ensureSelfOrAdmin(req, userId, res, "You are not allowed to access these promoter analytics.")) {
      return;
    }

    const data = await getPromoterAnalyticsSnapshot({
      promoterId: userId,
      campaignId: req.query.campaignId || null,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      range: req.query.range,
    });

    return res.json({
      success: true,
      data,
      filters: {
        campaignId: req.query.campaignId || null,
        startDate: req.query.startDate || null,
        endDate: req.query.endDate || null,
        range: req.query.range || "30",
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Get promoter analytics error:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to load promoter analytics.",
    });
  }
};
