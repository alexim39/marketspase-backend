import { CampaignModel } from "../models/campaign.model.js";

/**
 * Configuration for pagination and performance
 */
const CAMPAIGN_FETCH_CONFIG = {
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 100,
  SORT_FIELD: "-createdAt",
  OWNER_POPULATE_FIELDS: "displayName username email avatar uid",
  PROMOTIONS_POPULATE_FIELDS: "promoter views screenshotUrl status",
};

/**
 * Builds optimized MongoDB aggregation pipeline for fetching campaigns
 * More efficient than separate .populate() calls for large datasets
 */
const buildAggregationPipeline = ({ page = 1, limit, filters = {} }) => {
  const pageSize = Math.min(
    limit || CAMPAIGN_FETCH_CONFIG.DEFAULT_PAGE_SIZE,
    CAMPAIGN_FETCH_CONFIG.MAX_PAGE_SIZE
  );
  const skip = (page - 1) * pageSize;

  const pipeline = [
    { $match: filters },
    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: pageSize },
    // Lookup owner data (more efficient than populate for large datasets)
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          {
            $project: CAMPAIGN_FETCH_CONFIG.OWNER_POPULATE_FIELDS
              .split(" ")
              .reduce((acc, field) => {
                acc[field] = 1;
                return acc;
              }, {}),
          },
        ],
      },
    },
    { $unwind: { path: "$owner", preserveNullAndEmptyArrays: true } },
    // Lookup promotions data
    {
      $lookup: {
        from: "promotions",
        localField: "_id",
        foreignField: "campaign",
        as: "promotions",
        pipeline: [
          {
            $project: CAMPAIGN_FETCH_CONFIG.PROMOTIONS_POPULATE_FIELDS
              .split(" ")
              .reduce((acc, field) => {
                acc[field] = 1;
                return acc;
              }, {}),
          },
        ],
      },
    },
  ];

  return { pipeline, pageSize, skip };
};

/**
 * Fetches campaigns with pagination and performance optimizations
 */
const fetchCampaigns = async (query = {}) => {
  const { pipeline, pageSize } = buildAggregationPipeline(query);

  // Execute aggregation with parallel operations
  const [campaigns, totalCount] = await Promise.all([
    CampaignModel.aggregate(pipeline).exec(),
    CampaignModel.countDocuments(query.filters || {}),
  ]);

  return {
    campaigns,
    pagination: {
      page: query.page || 1,
      limit: pageSize,
      total: totalCount,
      pages: Math.ceil(totalCount / pageSize),
      hasMore: totalCount > (query.page || 1) * pageSize,
    },
  };
};

/**
 * Controller to get campaigns with pagination and performance optimizations
 */

export const getAllCampaigns = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit, 
      status, 
      category,
      search,
      startDate, 
      endDate 
    } = req.query;

    // Build filters from query params
    const filters = {};
    
    // Handle multiple status values
    if (status) {
      const statusArray = Array.isArray(status) ? status : [status];
      if (statusArray.length > 0) {
        filters.status = { $in: statusArray };
      }
    }
    
    // Handle multiple category values
    if (category) {
      const categoryArray = Array.isArray(category) ? category : [category];
      if (categoryArray.length > 0) {
        filters.category = { $in: categoryArray };
      }
    }
    
    // Handle search
    if (search) {
      filters.$or = [
        { title: { $regex: search, $options: 'i' } },
        { 'owner.displayName': { $regex: search, $options: 'i' } },
        { 'owner.email': { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (startDate || endDate) {
      filters.createdAt = {};
      if (startDate) filters.createdAt.$gte = new Date(startDate);
      if (endDate) filters.createdAt.$lte = new Date(endDate);
    }

    const { campaigns, pagination } = await fetchCampaigns({
      page: parseInt(page, 10),
      limit: limit ? parseInt(limit, 10) : undefined,
      filters,
    });

    // Set cache headers for CDN/browser caching
    res.set({
      "Cache-Control": "public, max-age=60", // Cache for 1 minute
      "X-Total-Count": pagination.total,
      "X-Page": pagination.page,
      "X-Page-Size": pagination.limit,
    });

    res.status(200).json({
      success: true,
      message: "Campaigns fetched successfully.",
      data: campaigns,
      pagination, // Include pagination data in response
    });
  } catch (error) {
    console.error("Error fetching campaigns:", error);

    // Handle specific MongoDB errors
    if (error.name === "MongoError" || error.name === "MongoServerError") {
      if (error.code === 16500) {
        return res.status(429).json({
          success: false,
          message: "Database resources temporarily exceeded. Please try again later.",
          retryAfter: 60,
        });
      }
    }

    res.status(500).json({
      success: false,
      message: "An error occurred while fetching campaigns.",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

/* export const getAllCampaigns = async (req, res) => {
  try {
    const { page = 1, limit, status, startDate, endDate } = req.query;

    // Build filters from query params
    const filters = {};
    if (status) filters.status = status;
    if (startDate || endDate) {
      filters.createdAt = {};
      if (startDate) filters.createdAt.$gte = new Date(startDate);
      if (endDate) filters.createdAt.$lte = new Date(endDate);
    }

    const { campaigns, pagination } = await fetchCampaigns({
      page: parseInt(page, 10),
      limit: limit ? parseInt(limit, 10) : undefined,
      filters,
    });

    // Set cache headers for CDN/browser caching
    res.set({
      "Cache-Control": "public, max-age=60", // Cache for 1 minute
      "X-Total-Count": pagination.total,
      "X-Page": pagination.page,
      "X-Page-Size": pagination.limit,
    });

    res.status(200).json({
      success: true,
      message: "Campaigns fetched successfully.",
      data: campaigns,
      pagination,
    });
  } catch (error) {
    console.error("Error fetching campaigns:", error);

    // Handle specific MongoDB errors
    if (error.name === "MongoError" || error.name === "MongoServerError") {
      if (error.code === 16500) {
        // MongoDB Atlas might throw resource exhaustion errors
        return res.status(429).json({
          success: false,
          message: "Database resources temporarily exceeded. Please try again later.",
          retryAfter: 60,
        });
      }
    }

    res.status(500).json({
      success: false,
      message: "An error occurred while fetching campaigns.",
      // Don't expose internal error details in production
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
}; */