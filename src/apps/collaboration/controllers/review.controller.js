import mongoose from "mongoose";
import { NotificationService } from "../../notification/services/notification.service.js";
import { UserModel } from "../../user/models/user/index.js";
import { CollaborationReviewModel } from "../models/index.js";
import { getReviewEligibility, recomputeCollaborationRating } from "../services/collaboration-review.service.js";
import { toIdString } from "../services/collaboration-access.service.js";
import { GetReviewEligibilityDto } from "../application/dto/get-review-eligibility.dto.js";
import { CreateCollaborationReviewDto } from "../application/dto/create-collaboration-review.dto.js";
import { FlagCollaborationReviewDto } from "../application/dto/flag-collaboration-review.dto.js";
import { ListAdminReviewsDto } from "../application/dto/list-admin-reviews.dto.js";
import { ListGivenReviewsDto } from "../application/dto/list-given-reviews.dto.js";
import { ListReceivedReviewsDto } from "../application/dto/list-received-reviews.dto.js";
import { ModerateCollaborationReviewDto } from "../application/dto/moderate-collaboration-review.dto.js";
import { CreateCollaborationReviewUseCase } from "../application/use-cases/create-collaboration-review.use-case.js";
import { FlagCollaborationReviewUseCase } from "../application/use-cases/flag-collaboration-review.use-case.js";
import { GetReviewEligibilityUseCase } from "../application/use-cases/get-review-eligibility.use-case.js";
import { ListAdminReviewsUseCase } from "../application/use-cases/list-admin-reviews.use-case.js";
import { ListGivenReviewsUseCase } from "../application/use-cases/list-given-reviews.use-case.js";
import { ListReceivedReviewsUseCase } from "../application/use-cases/list-received-reviews.use-case.js";
import { ModerateCollaborationReviewUseCase } from "../application/use-cases/moderate-collaboration-review.use-case.js";
import { MongooseCollaborationReviewGateway } from "../infrastructure/gateways/mongoose-collaboration-review.gateway.js";

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;

const collaborationReviewGateway = new MongooseCollaborationReviewGateway();
const getReviewEligibilityUseCase = new GetReviewEligibilityUseCase({ collaborationReviewGateway });
const listReceivedReviewsUseCase = new ListReceivedReviewsUseCase({ collaborationReviewGateway });
const listGivenReviewsUseCase = new ListGivenReviewsUseCase({ collaborationReviewGateway });
const listAdminReviewsUseCase = new ListAdminReviewsUseCase({ collaborationReviewGateway });
const createCollaborationReviewUseCase = new CreateCollaborationReviewUseCase({ collaborationReviewGateway });
const flagCollaborationReviewUseCase = new FlagCollaborationReviewUseCase({ collaborationReviewGateway });
const moderateCollaborationReviewUseCase = new ModerateCollaborationReviewUseCase({ collaborationReviewGateway });

const isCollaborationDddEnabled = () => process.env.COLLABORATION_DDD_ENABLED !== "false";

const parseLimit = (value, fallback = DEFAULT_LIMIT) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, MAX_LIMIT);
};

const buildPagination = async ({ query, page, limit }) => {
  const total = await CollaborationReviewModel.countDocuments(query);
  return {
    total,
    page,
    limit,
    totalPages: Math.max(Math.ceil(total / limit), 1),
  };
};

export const getReviewEligibilityController = async (req, res) => {
  if (isCollaborationDddEnabled()) {
    try {
      const response = await getReviewEligibilityUseCase.execute(
        GetReviewEligibilityDto.fromRequest({
          user: req.user || null,
          params: req.params || {},
          query: req.query || {},
        })
      );

      return res.status(response.statusCode).json(response.body);
    } catch (error) {
      console.error("Get collaboration review eligibility error:", error);
      return res.status(error.status || 500).json({
        success: false,
        message: error.message || "Failed to check review eligibility.",
      });
    }
  }

  try {
    const result = await getReviewEligibility({
      reviewerId: req.user?._id,
      revieweeId: req.params.targetUserId,
      promotionId: req.query.promotionId || null,
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Get collaboration review eligibility error:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to check review eligibility.",
    });
  }
};

export const createReview = async (req, res) => {
  if (isCollaborationDddEnabled()) {
    try {
      const response = await createCollaborationReviewUseCase.execute(
        CreateCollaborationReviewDto.fromRequest({
          user: req.user || null,
          body: req.body || {},
        })
      );

      return res.status(response.statusCode).json(response.body);
    } catch (error) {
      console.error("Create collaboration review error:", error);
      return res.status(error?.code === 11000 ? 409 : (error.status || 500)).json({
        success: false,
        message: error?.code === 11000
          ? "You have already reviewed this collaboration."
          : (error.message || "Failed to publish this review."),
      });
    }
  }

  try {
    const revieweeId = req.body?.revieweeId;
    const promotionId = req.body?.promotionId;
    const rating = Number(req.body?.rating);
    const title = String(req.body?.title || "").trim();
    const comment = String(req.body?.comment || "").trim();

    if (!mongoose.Types.ObjectId.isValid(revieweeId)) {
      return res.status(400).json({
        success: false,
        message: "A valid review target is required.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(promotionId)) {
      return res.status(400).json({
        success: false,
        message: "A valid collaboration promotion is required.",
      });
    }

    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5.",
      });
    }

    const eligibility = await getReviewEligibility({
      reviewerId: req.user?._id,
      revieweeId,
      promotionId,
    });

    if (!eligibility.eligible) {
      return res.status(403).json({
        success: false,
        message: eligibility.reason || "You cannot review this collaboration yet.",
      });
    }

    const review = await CollaborationReviewModel.create({
      reviewer: req.user._id,
      reviewee: revieweeId,
      campaign: eligibility.campaign?._id || null,
      promotion: eligibility.promotion?._id || null,
      relationshipType: eligibility.relationshipType,
      rating,
      title,
      comment,
      status: "published",
      publishedAt: new Date(),
    });

    await recomputeCollaborationRating(revieweeId);

    const populatedReview = await CollaborationReviewModel.findById(review._id)
      .populate("reviewer", "displayName username avatar role isVerified")
      .populate("reviewee", "displayName username avatar role isVerified")
      .populate("campaign", "title status")
      .populate("promotion", "upi status")
      .lean();

    await NotificationService.createReviewReceivedNotification(revieweeId, populatedReview);

    return res.status(201).json({
      success: true,
      data: populatedReview,
      message: "Review published successfully.",
    });
  } catch (error) {
    console.error("Create collaboration review error:", error);
    return res.status(error?.code === 11000 ? 409 : (error.status || 500)).json({
      success: false,
      message: error?.code === 11000
        ? "You have already reviewed this collaboration."
        : (error.message || "Failed to publish this review."),
    });
  }
};

export const getReceivedReviews = async (req, res) => {
  if (isCollaborationDddEnabled()) {
    try {
      const response = await listReceivedReviewsUseCase.execute(
        ListReceivedReviewsDto.fromRequest({
          user: req.user || null,
          params: req.params || {},
          query: req.query || {},
        })
      );

      return res.status(response.statusCode).json(response.body);
    } catch (error) {
      console.error("Get received collaboration reviews error:", error);
      return res.status(error.status || 500).json({
        success: false,
        message: error.message || "Failed to load reviews.",
      });
    }
  }

  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user ID." });
    }

    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = parseLimit(req.query.limit);
    const skip = (page - 1) * limit;
    const includeHidden = req.user?.role === "admin" && req.query.includeHidden === "true";

    const query = {
      reviewee: new mongoose.Types.ObjectId(userId),
      ...(includeHidden ? {} : { status: { $in: ["published", "flagged"] } }),
    };

    const [reviews, pagination, summary] = await Promise.all([
      CollaborationReviewModel.find(query)
        .populate("reviewer", "displayName username avatar role isVerified")
        .populate("campaign", "title status")
        .populate("promotion", "upi status")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      buildPagination({ query, page, limit }),
      CollaborationReviewModel.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            averageRating: { $avg: "$rating" },
            totalReviews: { $sum: 1 },
            flagged: {
              $sum: {
                $cond: [{ $eq: ["$status", "flagged"] }, 1, 0],
              },
            },
          },
        },
      ]),
    ]);

    return res.json({
      success: true,
      data: reviews,
      pagination,
      summary: {
        averageRating: Number(summary[0]?.averageRating || 0),
        totalReviews: Number(summary[0]?.totalReviews || 0),
        flagged: Number(summary[0]?.flagged || 0),
      },
    });
  } catch (error) {
    console.error("Get received collaboration reviews error:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to load reviews.",
    });
  }
};

export const getGivenReviews = async (req, res) => {
  if (isCollaborationDddEnabled()) {
    try {
      const response = await listGivenReviewsUseCase.execute(
        ListGivenReviewsDto.fromRequest({
          params: req.params || {},
          query: req.query || {},
        })
      );

      return res.status(response.statusCode).json(response.body);
    } catch (error) {
      console.error("Get given collaboration reviews error:", error);
      return res.status(error.status || 500).json({
        success: false,
        message: error.message || "Failed to load authored reviews.",
      });
    }
  }

  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user ID." });
    }

    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = parseLimit(req.query.limit);
    const skip = (page - 1) * limit;
    const query = {
      reviewer: new mongoose.Types.ObjectId(userId),
    };

    const [reviews, pagination] = await Promise.all([
      CollaborationReviewModel.find(query)
        .populate("reviewee", "displayName username avatar role isVerified")
        .populate("campaign", "title status")
        .populate("promotion", "upi status")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      buildPagination({ query, page, limit }),
    ]);

    return res.json({
      success: true,
      data: reviews,
      pagination,
    });
  } catch (error) {
    console.error("Get given collaboration reviews error:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to load authored reviews.",
    });
  }
};

export const flagReview = async (req, res) => {
  if (isCollaborationDddEnabled()) {
    try {
      const response = await flagCollaborationReviewUseCase.execute(
        FlagCollaborationReviewDto.fromRequest({
          user: req.user || null,
          params: req.params || {},
          body: req.body || {},
        })
      );

      return res.status(response.statusCode).json(response.body);
    } catch (error) {
      console.error("Flag collaboration review error:", error);
      return res.status(error.status || 500).json({
        success: false,
        message: error.message || "Failed to flag this review.",
      });
    }
  }

  try {
    const reviewId = req.params.reviewId;
    const reason = String(req.body?.reason || "").trim();
    const details = String(req.body?.details || "").trim();

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "A flag reason is required.",
      });
    }

    const review = await CollaborationReviewModel.findById(reviewId)
      .populate("reviewer", "displayName username")
      .populate("reviewee", "displayName username")
      .populate("campaign", "title")
      .populate("promotion", "upi")
      .lean();

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found.",
      });
    }

    const alreadyFlagged = (review.flags || []).some((flag) => toIdString(flag.user) === toIdString(req.user?._id));
    if (alreadyFlagged) {
      return res.status(409).json({
        success: false,
        message: "You have already flagged this review.",
      });
    }

    const updatedReview = await CollaborationReviewModel.findByIdAndUpdate(
      reviewId,
      {
        $push: {
          flags: {
            user: req.user._id,
            reason,
            details,
            createdAt: new Date(),
          },
        },
        $inc: { flagCount: 1 },
        $set: {
          status: review.status === "removed" ? "removed" : "flagged",
        },
      },
      { new: true }
    )
      .populate("reviewer", "displayName username")
      .populate("reviewee", "displayName username")
      .populate("campaign", "title")
      .populate("promotion", "upi")
      .lean();

    const adminRecipients = await UserModel.find({ role: { $in: ["admin", "super-admin"] } })
      .select("_id")
      .lean();

    await Promise.all(adminRecipients.map((admin) =>
      NotificationService.createReviewFlaggedAdminNotification(admin._id, updatedReview, reason)
    ));

    return res.json({
      success: true,
      data: updatedReview,
      message: "Review flagged for moderation.",
    });
  } catch (error) {
    console.error("Flag collaboration review error:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to flag this review.",
    });
  }
};

export const getAdminReviews = async (req, res) => {
  if (isCollaborationDddEnabled()) {
    try {
      const response = await listAdminReviewsUseCase.execute(
        ListAdminReviewsDto.fromRequest({
          query: req.query || {},
        })
      );

      return res.status(response.statusCode).json(response.body);
    } catch (error) {
      console.error("Get admin collaboration reviews error:", error);
      return res.status(error.status || 500).json({
        success: false,
        message: error.message || "Failed to load moderation reviews.",
      });
    }
  }

  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = parseLimit(req.query.limit, 20);
    const skip = (page - 1) * limit;
    const search = String(req.query.search || "").trim();
    const status = String(req.query.status || "all");
    const flaggedOnly = req.query.flaggedOnly === "true";

    const query = {};
    if (status !== "all") {
      query.status = status;
    }
    if (flaggedOnly) {
      query.flagCount = { $gt: 0 };
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { comment: { $regex: search, $options: "i" } },
      ];
    }

    const [reviews, pagination, summary] = await Promise.all([
      CollaborationReviewModel.find(query)
        .populate("reviewer", "displayName username avatar role")
        .populate("reviewee", "displayName username avatar role")
        .populate("campaign", "title status")
        .populate("promotion", "upi status")
        .sort({ flagCount: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      buildPagination({ query, page, limit }),
      CollaborationReviewModel.aggregate([
        {
          $group: {
            _id: null,
            totalReviews: { $sum: 1 },
            published: {
              $sum: { $cond: [{ $eq: ["$status", "published"] }, 1, 0] },
            },
            flagged: {
              $sum: { $cond: [{ $eq: ["$status", "flagged"] }, 1, 0] },
            },
            hidden: {
              $sum: { $cond: [{ $eq: ["$status", "hidden"] }, 1, 0] },
            },
            removed: {
              $sum: { $cond: [{ $eq: ["$status", "removed"] }, 1, 0] },
            },
          },
        },
      ]),
    ]);

    return res.json({
      success: true,
      data: reviews,
      pagination,
      summary: {
        totalReviews: Number(summary[0]?.totalReviews || 0),
        published: Number(summary[0]?.published || 0),
        flagged: Number(summary[0]?.flagged || 0),
        hidden: Number(summary[0]?.hidden || 0),
        removed: Number(summary[0]?.removed || 0),
      },
    });
  } catch (error) {
    console.error("Get admin collaboration reviews error:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to load moderation reviews.",
    });
  }
};

export const moderateReview = async (req, res) => {
  if (isCollaborationDddEnabled()) {
    try {
      const response = await moderateCollaborationReviewUseCase.execute(
        ModerateCollaborationReviewDto.fromRequest({
          user: req.user || null,
          params: req.params || {},
          body: req.body || {},
        })
      );

      return res.status(response.statusCode).json(response.body);
    } catch (error) {
      console.error("Moderate collaboration review error:", error);
      return res.status(error.status || 500).json({
        success: false,
        message: error.message || "Failed to update this review.",
      });
    }
  }

  try {
    const review = await CollaborationReviewModel.findById(req.params.reviewId).lean();
    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found.",
      });
    }

    const action = String(req.body?.action || "").trim();
    const note = String(req.body?.note || "").trim();
    const response = String(req.body?.response || "").trim();

    const update = {
      moderationNotes: note,
      adminResponse: response,
      moderatedBy: req.user?._id,
    };

    if (action === "publish") {
      update.status = "published";
      update.hiddenAt = null;
    } else if (action === "hide") {
      update.status = "hidden";
      update.hiddenAt = new Date();
    } else if (action === "remove") {
      update.status = "removed";
      update.hiddenAt = new Date();
    } else if (action === "restore") {
      update.status = "published";
      update.hiddenAt = null;
    } else {
      return res.status(400).json({
        success: false,
        message: "Unknown moderation action.",
      });
    }

    const updatedReview = await CollaborationReviewModel.findByIdAndUpdate(
      review._id,
      { $set: update },
      { new: true }
    )
      .populate("reviewer", "displayName username avatar role")
      .populate("reviewee", "displayName username avatar role")
      .populate("campaign", "title status")
      .populate("promotion", "upi status")
      .lean();

    await recomputeCollaborationRating(review.reviewee);

    return res.json({
      success: true,
      data: updatedReview,
      message: "Review moderation updated.",
    });
  } catch (error) {
    console.error("Moderate collaboration review error:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to update this review.",
    });
  }
};
