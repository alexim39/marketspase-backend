// promotion.controller.js
import mongoose from "mongoose";
import { PromotionModel } from "../../promotion/models/index.js";
import { UserModel } from "../../user/models/user/index.js";
import { isPromotionExpired, calculateTimeRemaining, calculateProgressPercentage } from './../services/utils.js';
import { normalizePromotionTrackingFields } from "../utils/promotion-url.js";
import { normalizeLegacyPpcPromotionStatus } from "../../campaign/services/campaign-runtime.service.js";

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 10;
const PROMOTION_LIST_SELECT = [
  "_id",
  "status",
  "acceptedAt",
  "rejectedAt",
  "paidAt",
  "payoutAmount",
  "costPerClick",
  "viewsAchieved",
  "rejectionReason",
  "upi",
  "promotionUrl",
  "isActive",
  "clickStats",
  "fraudStatus",
  "createdAt",
  "campaign"
].join(" ");

const CAMPAIGN_LIST_SELECT = [
  "_id",
  "title",
  "caption",
  "currency",
  "costPerClick",
  "payoutPerPromotion",
  "mediaUrl",
  "thumbnailUrl",
      "mediaType",
      "category",
      "budget",
      "spentBudget",
      "remainingBudget",
      "endDate"
].join(" ");

const ALLOWED_SORT_FIELDS = new Set([
  "createdAt",
  "updatedAt",
  "acceptedAt",
  "paidAt",
]);

const ACTIVE_PROMOTION_STATUSES = ["accepted"];


// Get all promotions for a user with filtering and pagination
export const GetUserPromotions = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    //console.log('User viewing accepted promtions')

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

    if (req.user.role !== 'admin' && req.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view these promotions.",
      });
    }

    // Validate and limit maximum records per page
    const parsedLimit = Number.parseInt(limit, 10);
    const safeLimit = Math.min(
      Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE
    );
    const safePage = Math.max(parseInt(page), 1);

    const isSelfRequest = req.userId === userId;

    if (!isSelfRequest) {
      const user = await UserModel.findById(userId).select("_id").lean();
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found.",
        });
      }
    } else if (req.user.role !== "admin") {
      // Avoid blocking the response path on a low-priority profile freshness write.
      UserModel.updateOne(
        { _id: userId },
        { $set: { lastSeenAt: new Date() } }
      ).catch((error) => {
        console.warn("Unable to update promoter lastSeenAt while loading promotions:", error.message);
      });
    }

    // Build query
    const query = { promoter: userId };
    if (status && status !== 'all') {
      if (status === 'active') {
        query.status = { $in: ACTIVE_PROMOTION_STATUSES };
        query.isActive = true;
      } else {
        query.status = status;
      }
    }

    // Build sort object
    const safeSortBy = ALLOWED_SORT_FIELDS.has(sortBy) ? sortBy : "createdAt";
    const sort = {};
    sort[safeSortBy] = sortOrder === 'desc' ? -1 : 1;

    const [promotions, total] = await Promise.all([
      PromotionModel.find(query)
        .select(PROMOTION_LIST_SELECT)
        .populate({
          path: "campaign",
          select: CAMPAIGN_LIST_SELECT,
          options: { lean: true },
        })
        .sort(sort)
        .limit(safeLimit)
        .skip((safePage - 1) * safeLimit)
        .lean(),
      PromotionModel.countDocuments(query),
    ]);

    res.set("Cache-Control", "no-store");

    if (!promotions || promotions.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        totalPages: 0,
        currentPage: safePage,
        total: 0,
      });
    }

    // Calculate additional data for each promotion
    const enhancedPromotions = promotions.map(promotion => ({
      ...normalizePromotionTrackingFields(promotion),
      status: normalizeLegacyPpcPromotionStatus(promotion.status, promotion.isActive),
      isExpired: isPromotionExpired(promotion),
      timeRemaining: calculateTimeRemaining(promotion),
      progressPercentage: calculateProgressPercentage(promotion)
    }));

    res.status(200).json({
      success: true,
      data: enhancedPromotions,
      totalPages: Math.ceil(total / safeLimit),
      currentPage: safePage,
      total
    });

  } catch (error) {
    console.error('Error fetching user promotions:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
