import { ProductModel } from '../../models/promotion/index.js';
import { ReviewModel } from '../../models/review/index.js'; // You'll need to create this model
import mongoose from "mongoose";

/**
 * @desc    Get product reviews with pagination
 * @route   GET /api/storefront/products/:productId/reviews
 * @access  Public
 */
export const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    const { 
      page = 1, 
      limit = 10, 
      sortBy = 'newest',
      rating,
      verifiedOnly = 'false',
      withImagesOnly = 'false'
    } = req.query;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format'
      });
    }

    // Check if product exists
    const product = await ProductModel.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Build query
    const query = { 
      productId,
      status: 'approved' // Only show approved reviews
    };

    // Apply rating filter
    if (rating) {
      const ratingValue = parseFloat(rating);
      if (!isNaN(ratingValue) && ratingValue >= 1 && ratingValue <= 5) {
        query.rating = ratingValue;
      }
    }

    // Apply verified purchase filter
    if (verifiedOnly === 'true') {
      query.verifiedPurchase = true;
    }

    // Apply with images filter
    if (withImagesOnly === 'true') {
      query.images = { $exists: true, $ne: [] };
    }

    // Determine sort order
    let sortOptions = {};
    switch (sortBy) {
      case 'newest':
        sortOptions = { createdAt: -1 };
        break;
      case 'oldest':
        sortOptions = { createdAt: 1 };
        break;
      case 'highest':
        sortOptions = { rating: -1, helpfulCount: -1 };
        break;
      case 'lowest':
        sortOptions = { rating: 1, helpfulCount: -1 };
        break;
      case 'helpful':
        sortOptions = { helpfulCount: -1, createdAt: -1 };
        break;
      default:
        sortOptions = { createdAt: -1 };
    }

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Execute queries
    const [reviews, totalCount] = await Promise.all([
      ReviewModel.find(query)
        .populate('userId', 'name avatar')
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      ReviewModel.countDocuments(query)
    ]);

    // Calculate rating breakdown
    const ratingBreakdown = await ReviewModel.aggregate([
      { $match: { productId: new mongoose.Types.ObjectId(productId), status: 'approved' } },
      { $group: {
        _id: '$rating',
        count: { $sum: 1 }
      }},
      { $sort: { _id: -1 } }
    ]);

    const breakdown = {
      5: 0, 4: 0, 3: 0, 2: 0, 1: 0
    };
    
    ratingBreakdown.forEach(item => {
      breakdown[item._id] = item.count;
    });

    // Get review summary statistics
    const statistics = await ReviewModel.aggregate([
      { $match: { productId: new mongoose.Types.ObjectId(productId), status: 'approved' } },
      { $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 },
        verifiedCount: { $sum: { $cond: ['$verifiedPurchase', 1, 0] } },
        withImagesCount: { $sum: { $cond: [{ $gt: [{ $size: { $ifNull: ['$images', []] } }, 0] }, 1, 0] } }
      }}
    ]);

    const summary = statistics[0] || {
      averageRating: product.averageRating || 0,
      totalReviews: product.ratingCount || 0,
      verifiedCount: 0,
      withImagesCount: 0
    };

    // Format reviews for response
    const formattedReviews = reviews.map(review => ({
      ...review,
      user: review.userId ? {
        _id: review.userId._id,
        name: review.userId.name,
        avatar: review.userId.avatar
      } : null,
      userId: undefined
    }));

    res.status(200).json({
      success: true,
      data: formattedReviews,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        pages: Math.ceil(totalCount / limitNum)
      },
      summary: {
        averageRating: summary.averageRating || 0,
        totalReviews: summary.totalReviews || 0,
        ratingBreakdown: breakdown,
        verifiedCount: summary.verifiedCount || 0,
        withImagesCount: summary.withImagesCount || 0
      }
    });
  } catch (error) {
    console.error('Get product reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};