import mongoose from "mongoose";
import { ensureSelfOrAdmin, getAuthenticatedUserId } from "../../../shared/utils/request-auth.util.js";
import { UserModel } from "../../user/models/user/index.js";
import { PromotionModel } from "../../promotion/models/index.js";
import { PromotionFraudCaseModel } from "../models/promotion-fraud-case.model.js";

const ACTIVE_CASE_STATUSES = ["open", "warning_sent", "final_warning_sent", "suspended"];

export const getPromoterFraudSummaryController = async (req, res) => {
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

    if (!ensureSelfOrAdmin(req, userId, res, "You are not allowed to access this compliance report.")) {
      return;
    }

    const promoterObjectId = new mongoose.Types.ObjectId(userId);

    const [promoter, caseStats, totalCases, activeCases, suspendedCases, blockedPromotions] =
      await Promise.all([
        UserModel.findById(userId)
          .select("_id displayName username email isActive fraudProfile")
          .lean(),
        PromotionFraudCaseModel.aggregate([
          { $match: { promoter: promoterObjectId } },
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),
        PromotionFraudCaseModel.countDocuments({ promoter: promoterObjectId }),
        PromotionFraudCaseModel.countDocuments({
          promoter: promoterObjectId,
          status: { $in: ACTIVE_CASE_STATUSES },
        }),
        PromotionFraudCaseModel.countDocuments({
          promoter: promoterObjectId,
          suspendedAt: { $ne: null },
        }),
        PromotionModel.countDocuments({
          promoter: promoterObjectId,
          isActive: false,
          "fraudStatus.isFlagged": true,
          "fraudStatus.reviewStatus": { $in: ["warning", "final_warning", "blocked"] },
        }),
      ]);

    if (!promoter) {
      return res.status(404).json({
        success: false,
        message: "Promoter account not found.",
      });
    }

    const statusCounts = {
      open: 0,
      warning_sent: 0,
      final_warning_sent: 0,
      suspended: 0,
      resolved: 0,
      dismissed: 0,
    };

    for (const row of caseStats || []) {
      if (row?._id && Object.prototype.hasOwnProperty.call(statusCounts, row._id)) {
        statusCounts[row._id] = row.count;
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        promoter: {
          _id: promoter._id,
          displayName: promoter.displayName,
          username: promoter.username,
          email: promoter.email,
          isActive: promoter.isActive,
        },
        fraudProfile: promoter.fraudProfile || null,
        summary: {
          totalCases,
          activeCases,
          suspendedCases,
          blockedPromotions,
          statusCounts,
        },
      },
      generatedAt: new Date().toISOString(),
      message: "Promoter compliance summary loaded successfully",
    });
  } catch (error) {
    console.error("Error loading promoter fraud summary:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to load promoter compliance summary.",
    });
  }
};

