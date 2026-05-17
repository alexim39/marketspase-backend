import { CampaignModel } from '../../../campaign/models/campaign.model.js';
import { PromotionModel } from "../../../promotion/models/promotion.model.js";
import { UserModel } from "../../../user/models/user/index.js";
import { normalizePromotionTrackingFields } from "../../utils/promotion-url.js";


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
      filter.status = { $in: statusArray };
    }

    // Campaign filter
    if (campaign) {
      const campaignArray = Array.isArray(campaign) ? campaign : [campaign];
      filter.campaign = { $in: campaignArray };
    }

    // Date range filter
    if (startDate || endDate) {
      filter.$or = [
        { submittedAt: {} },
        { createdAt: {} }
      ];
      
      if (startDate) {
        const start = new Date(startDate);
        filter.$or[0].submittedAt.$gte = start;
        filter.$or[1].createdAt.$gte = start;
      }
      
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.$or[0].submittedAt.$lte = end;
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
      .populate('campaign', 'title category payoutPerPromotion owner')
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
    const stats = await PromotionModel.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const statsObject = {
      total: 0,
      pending: 0,
      submitted: 0,
      validated: 0,
      paid: 0,
      rejected: 0
    };

    stats.forEach(stat => {
      statsObject[stat._id] = stat.count;
      statsObject.total += stat.count;
    });

    res.status(200).json({
      success: true,
      data: promotions.map((promotion) => normalizePromotionTrackingFields(promotion)),
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
