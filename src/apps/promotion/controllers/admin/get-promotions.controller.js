import { CampaignModel } from '../../../campaign/models/campaign.model.js';
import { PromotionModel } from "../../../promotion/models/promotion.model.js";
import { UserModel } from "../../../user/models/user/index.js";
import { normalizePromotionTrackingFields } from "../../utils/promotion-url.js";
import { normalizeLegacyPpcPromotionStatus } from "../../../campaign/services/campaign-runtime.service.js";

const ACTIVE_PROMOTION_STATUSES = ["accepted", "downloaded", "submitted", "validated"];

const getEffectivePromotionStatus = (promotion) => {
  const normalizedStatus = normalizeLegacyPpcPromotionStatus(promotion.status, promotion.isActive);
  if (normalizedStatus === "accepted" && promotion.isActive === false) {
    return "inactive";
  }

  return normalizedStatus;
};


/**
 * @desc    Get all promotions for admin with filtering and pagination
 * @route   GET /api/admin/promotions
 * @access  Private/Admin
 */
export const GetAdminPromotions = async (req, res) => {
  try {
    const {
      status,
      campaign,
      search,
      startDate,
      endDate,
      page = 1,
      limit = 1000,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};

    // Status filter
    if (status) {
      const statusArray = Array.isArray(status) ? status : [status];

      if (statusArray.includes("active") || statusArray.includes("accepted")) {
        filter.status = { $in: ACTIVE_PROMOTION_STATUSES };
        filter.isActive = true;
      } else if (statusArray.includes("inactive")) {
        filter.status = { $in: ACTIVE_PROMOTION_STATUSES };
        filter.isActive = false;
      } else {
        filter.status = { $in: statusArray };
      }
    }

    // Campaign filter
    if (campaign) {
      const campaignArray = Array.isArray(campaign) ? campaign : [campaign];
      filter.campaign = { $in: campaignArray };
    }

    // Date range filter
    if (startDate || endDate) {
      filter.$or = [
        { acceptedAt: {} },
        { createdAt: {} }
      ];
      
      if (startDate) {
        const start = new Date(startDate);
        filter.$or[0].acceptedAt.$gte = start;
        filter.$or[1].createdAt.$gte = start;
      }
      
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.$or[0].acceptedAt.$lte = end;
        filter.$or[1].createdAt.$lte = end;
      }
    }

    // Search filter
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      
      // Get promoter IDs that match search
      const matchingPromoters = await UserModel.find({
        $or: [
          { displayName: searchRegex },
          { email: searchRegex },
          { username: searchRegex }
        ]
      }).select('_id');
      
      const promoterIds = matchingPromoters.map(user => user._id);
      
      // Get campaign IDs that match search
      const matchingCampaigns = await CampaignModel.find({
        title: searchRegex
      }).select('_id');
      
      const campaignIds = matchingCampaigns.map(campaign => campaign._id);
      
      filter.$or = [
        ...(filter.$or || []),
        { upi: searchRegex },
        { promoter: { $in: promoterIds } },
        { campaign: { $in: campaignIds } }
      ];
    }

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Sort configuration
    const sortConfig = {};
    sortConfig[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Get promotions with population
    const promotions = await PromotionModel.find(filter)
      .populate('campaign', 'title category costPerClick payoutPerPromotion currency status owner')
      .populate('promoter', 'displayName email username avatar personalInfo.phoneDetails')
      .populate('validatedBy', 'displayName')
      .populate('paidBy', 'displayName')
      .sort(sortConfig)
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Get total count for pagination
    const total = await PromotionModel.countDocuments(filter);

    // Calculate stats
    const normalizedPromotions = promotions.map((promotion) => ({
      ...normalizePromotionTrackingFields(promotion),
      status: getEffectivePromotionStatus(promotion),
    }));

    const statsObject = normalizedPromotions.reduce((accumulator, promotion) => {
      const key = promotion.status || "unknown";
      accumulator.total += 1;
      accumulator[key] = (accumulator[key] || 0) + 1;
      return accumulator;
    }, {
      total: 0,
      accepted: 0,
      inactive: 0,
      paid: 0,
      rejected: 0,
    });

    res.status(200).json({
      success: true,
      data: normalizedPromotions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      },
      stats: statsObject,
      message: 'Promotions retrieved successfully'
    });

  } catch (error) {
    console.error('Get admin promotions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving promotions',
      error: error.message
    });
  }
};
