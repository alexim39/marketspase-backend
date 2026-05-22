import mongoose from "mongoose";
import { ensureSelfOrAdmin, getAuthenticatedUserId } from "../../../shared/utils/request-auth.util.js";
import { PromotionFraudCaseModel } from "../models/promotion-fraud-case.model.js";

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 25;

const sanitizeCase = (item) => {
  const reasons = Array.isArray(item?.reasons) ? item.reasons : [];
  const detectionTypes = Array.isArray(item?.detectionTypes) ? item.detectionTypes : [];
  const actionLog = Array.isArray(item?.actionLog) ? item.actionLog : [];

  return {
    _id: item?._id,
    status: item?.status,
    riskLevel: item?.riskLevel,
    riskScore: Number(item?.riskScore || 0),
    detectionTypes,
    reasons: reasons.map((reason) => ({
      code: reason?.code,
      label: reason?.label,
      score: Number(reason?.score || 0),
      details: reason?.details || "",
    })),
    promotion: item?.promotion
      ? {
          _id: item.promotion?._id,
          upi: item.promotion?.upi,
          status: item.promotion?.status,
          isActive: item.promotion?.isActive,
          fraudStatus: item.promotion?.fraudStatus || null,
          clickStats: item.promotion?.clickStats || null,
          promotionUrl: item.promotion?.promotionUrl,
        }
      : null,
    campaign: item?.campaign
      ? {
          _id: item.campaign?._id,
          title: item.campaign?.title,
          status: item.campaign?.status,
          category: item.campaign?.category,
        }
      : null,
    warningSentAt: item?.warningSentAt,
    finalWarningSentAt: item?.finalWarningSentAt,
    suspendedAt: item?.suspendedAt,
    suspendedUntil: item?.suspendedUntil,
    reviewedAt: item?.reviewedAt,
    resolutionNotes: item?.resolutionNotes || "",
    actionLog: actionLog.map((row) => ({
      action: row?.action,
      details: row?.details || "",
      timestamp: row?.timestamp,
    })),
    createdAt: item?.createdAt,
    updatedAt: item?.updatedAt,
  };
};

export const getPromoterFraudCasesController = async (req, res) => {
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

    const { status = "all", riskLevel = "all", page = 1, limit = DEFAULT_PAGE_SIZE } = req.query;

    const pageNum = Math.max(Number.parseInt(page, 10) || 1, 1);
    const parsedLimit = Number.parseInt(limit, 10);
    const limitNum = Math.max(
      Math.min(Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
      1
    );
    const skip = (pageNum - 1) * limitNum;

    const filter = { promoter: new mongoose.Types.ObjectId(userId) };

    if (status && status !== "all") {
      filter.status = String(status);
    }

    if (riskLevel && riskLevel !== "all") {
      filter.riskLevel = String(riskLevel);
    }

    const [cases, total] = await Promise.all([
      PromotionFraudCaseModel.find(filter)
        .populate("campaign", "title status category")
        .populate("promotion", "upi status isActive fraudStatus promotionUrl clickStats")
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      PromotionFraudCaseModel.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        cases: (cases || []).map(sanitizeCase),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
      generatedAt: new Date().toISOString(),
      message: "Promoter compliance cases loaded successfully",
    });
  } catch (error) {
    console.error("Error loading promoter fraud cases:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to load promoter compliance cases.",
    });
  }
};

