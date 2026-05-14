import mongoose from 'mongoose';
import { ProductModel } from '../../models/promotion/index.js';
import { ReviewModel } from '../../models/review/index.js';
import { getAuthenticatedUserId } from '../../../../shared/utils/request-auth.util.js';

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

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format'
      });
    }

    const product = await ProductModel.findById(productId).select('name averageRating ratingCount');
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;
    const currentUserId = getAuthenticatedUserId(req);

    const query = {
      productId,
      status: 'approved',
    };

    if (rating) {
      const ratingValue = parseInt(rating, 10);
      if (!Number.isNaN(ratingValue) && ratingValue >= 1 && ratingValue <= 5) {
        query.rating = ratingValue;
      }
    }

    if (verifiedOnly === 'true') {
      query.verifiedPurchase = true;
    }

    if (withImagesOnly === 'true') {
      query.images = { $exists: true, $ne: [] };
    }

    let sortOptions = { createdAt: -1 };
    switch (sortBy) {
      case 'oldest':
        sortOptions = { createdAt: 1 };
        break;
      case 'highest':
        sortOptions = { rating: -1, helpfulCount: -1, createdAt: -1 };
        break;
      case 'lowest':
        sortOptions = { rating: 1, helpfulCount: -1, createdAt: -1 };
        break;
      case 'helpful':
        sortOptions = { helpfulCount: -1, createdAt: -1 };
        break;
      default:
        sortOptions = { createdAt: -1 };
    }

    const [reviews, totalCount, ratingBreakdown, statistics] = await Promise.all([
      ReviewModel.find(query)
        .populate('userId', 'username displayName avatar')
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      ReviewModel.countDocuments(query),
      ReviewModel.aggregate([
        { $match: { productId: new mongoose.Types.ObjectId(productId), status: 'approved' } },
        {
          $group: {
            _id: '$rating',
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: -1 } }
      ]),
      ReviewModel.aggregate([
        { $match: { productId: new mongoose.Types.ObjectId(productId), status: 'approved' } },
        {
          $group: {
            _id: null,
            averageRating: { $avg: '$rating' },
            totalReviews: { $sum: 1 },
            verifiedCount: { $sum: { $cond: ['$verifiedPurchase', 1, 0] } },
            withImagesCount: {
              $sum: {
                $cond: [
                  { $gt: [{ $size: { $ifNull: ['$images', []] } }, 0] },
                  1,
                  0
                ]
              }
            }
          }
        }
      ])
    ]);

    const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    ratingBreakdown.forEach((item) => {
      if (item?._id >= 1 && item?._id <= 5) {
        breakdown[item._id] = Number(item.count || 0);
      }
    });

    const summary = statistics[0] || {
      averageRating: product.averageRating || 0,
      totalReviews: product.ratingCount || 0,
      verifiedCount: 0,
      withImagesCount: 0,
    };

    const formattedReviews = reviews.map((review) => ({
      _id: review._id,
      rating: review.rating,
      title: review.title || '',
      comment: review.comment,
      images: Array.isArray(review.images) ? review.images.map((image) => image?.url).filter(Boolean) : [],
      verifiedPurchase: Boolean(review.verifiedPurchase),
      helpfulCount: Number(review.helpfulCount || 0),
      reportCount: Number(review.reportCount || 0),
      isFeatured: Boolean(review.isFeatured),
      response: review.response || null,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      user: review.userId ? {
        _id: review.userId._id,
        displayName: review.userId.displayName || review.userId.username || 'Anonymous',
        avatar: review.userId.avatar || null
      } : null,
      isOwnReview: currentUserId ? String(review.userId?._id || review.userId) === String(currentUserId) : false,
      isHelpfulByCurrentUser: currentUserId
        ? Array.isArray(review.helpfulBy) && review.helpfulBy.some((id) => String(id) === String(currentUserId))
        : false,
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
        averageRating: Math.round(Number(summary.averageRating || 0) * 10) / 10,
        totalReviews: Number(summary.totalReviews || 0),
        ratingBreakdown: breakdown,
        verifiedCount: Number(summary.verifiedCount || 0),
        withImagesCount: Number(summary.withImagesCount || 0)
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
