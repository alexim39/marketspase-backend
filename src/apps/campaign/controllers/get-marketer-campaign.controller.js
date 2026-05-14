import { CampaignModel } from "../models/campaign.model.js";
import { ensureSelfOrAdmin, getAuthenticatedUserId } from "../../../shared/utils/request-auth.util.js";

/**
 * @description Fetches all campaigns owned by a specific user with pagination.
 * This function uses a read-only database query and does not require a transaction.
 * @param {object} req - The request object from Express.js, expected to contain the user ID and pagination parameters.
 * @param {object} res - The response object from Express.js.
 * @returns {Promise<void>}
 */
// In your GetAMarketerCampaigns function, add filter handling:
export const GetAMarketerCampaigns = async (req, res) => {
  try {
    const { userId } = req.params;
    const { 
      page = 1, 
      limit = 10,
      status,
      search,
      category,
      campaignType,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Validate that the user ID is present.
    if (!userId) {
      return res.status(400).json({
        message: "User ID is required.",
        success: false,
      });
    }

    const authenticatedUserId = getAuthenticatedUserId(req);
    if (!authenticatedUserId) {
      return res.status(401).json({
        message: "Authentication is required to view campaigns.",
        success: false,
      });
    }

    if (!ensureSelfOrAdmin(req, userId, res, "You are not authorized to view these campaigns.")) {
      return;
    }

    // Build query object
    const query = { owner: userId };
    
    // Add status filter if provided and not 'all'
    if (status && status !== 'all') {
      query.status = status;
    }
    
    // Add category filter if provided
    if (category) {
      query.category = category;
    }
    
    // Add campaign type filter if provided
    if (campaignType) {
      query.campaignType = campaignType;
    }
    
    // Add search filter if provided
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { caption: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } }
      ];
    }

    // Validate pagination parameters
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    if (pageNum < 1) {
      return res.status(400).json({
        message: "Page must be greater than 0.",
        success: false,
      });
    }

    if (limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        message: "Limit must be between 1 and 100.",
        success: false,
      });
    }

    const skip = (pageNum - 1) * limitNum;

    // Get total count with filters
    const totalCampaigns = await CampaignModel.countDocuments(query);

    // Calculate total pages
    const totalPages = Math.ceil(totalCampaigns / limitNum);

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Find campaigns with pagination, filters, and populate promotions
    const campaigns = await CampaignModel.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .populate({
        path: 'promotions',
        model: 'Promotion'
      });

    // Check if any campaigns were found.
    if (!campaigns || campaigns.length === 0) {
      return res.status(404).json({
        message: "No campaigns found for this user.",
        success: false,
        data: [],
        pagination: {
          currentPage: pageNum,
          totalPages: 0,
          totalCampaigns: 0,
          hasNext: false,
          hasPrev: false,
          limit: limitNum
        }
      });
    }

    // Calculate pagination metadata
    const hasNext = pageNum < totalPages;
    const hasPrev = pageNum > 1;

    // Return the found campaigns with pagination info
    return res.status(200).json({
      message: "Campaigns retrieved successfully.",
      success: true,
      data: campaigns,
      pagination: {
        currentPage: pageNum,
        totalPages: totalPages,
        totalCampaigns: totalCampaigns,
        hasNext: hasNext,
        hasPrev: hasPrev,
        limit: limitNum
      }
    });
  } catch (error) {
    // Log the error for debugging purposes.
    console.error("Error retrieving user campaigns:", error.message);

    // Return a 500 status code for internal server errors.
    res.status(500).json({
      message: "An error occurred while retrieving campaigns.",
      success: false,
      error: error.message,
    });
  }
};
