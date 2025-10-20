// promotion.controller.js
import { PromotionModel } from "../../promotion/models/promotion.model.js";
import { UserModel } from "../../user/models/user.model.js";;
import { isPromotionExpired, calculateTimeRemaining, calculateProgressPercentage } from './../services/utils.js'



// Get all promotions for a user with filtering and pagination
export const GetUserPromotions = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    console.log('req.query ',req.query)

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required.",
      });
    }

    // Validate and limit maximum records per page
    const safeLimit = Math.min(parseInt(limit), 100);
    const safePage = Math.max(parseInt(page), 1);

    // Find user with only necessary fields
    const user = await UserModel.findById(userId).select('role');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Promoter not found.",
      });
    }

    if (user.role !== "promoter") {
      return res.status(400).json({
        success: false,
        message: "Your current user role is not promoter. Please switch roles to continue.",
      });
    }

    // Build query
    const query = { promoter: userId };
    if (status && status !== 'all') {
      query.status = status;
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with pagination and lean for performance
    const promotions = await PromotionModel.find(query)
      .populate({
        path: 'campaign',
        select: 'title category mediaUrl mediaType payoutPerPromotion minViewsPerPromotion'
      })
      .populate({
        path: "promoter",
        select: "-password",
      })
      .sort(sort)
      .limit(safeLimit)
      .skip((safePage - 1) * safeLimit)
      .lean(); // Use lean for better performance

    if (!promotions || promotions.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No promotions found for this user.",
      });
    }

    // Get total count for pagination
    const total = await PromotionModel.countDocuments(query);

    // Calculate additional data for each promotion
    const enhancedPromotions = promotions.map(promotion => ({
      ...promotion,
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
