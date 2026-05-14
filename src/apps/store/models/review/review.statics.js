import mongoose from "mongoose";
import { REVIEW_STATUS } from "./review.constants.js";
import { formatReviewResponse } from "./review.utils.js";

export const setupReviewStatics = (schema) => {
  // Get product statistics
  schema.statics.getProductStats = async function(productId) {
    const stats = await this.aggregate([
      { $match: { productId: new mongoose.Types.ObjectId(productId), status: 'approved' } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
          verifiedCount: { $sum: { $cond: ['$verifiedPurchase', 1, 0] } },
          withImagesCount: { $sum: { $cond: [{ $gt: [{ $size: { $ifNull: ['$images', []] } }, 0] }, 1, 0] } },
          withResponseCount: { $sum: { $cond: [{ $ne: ['$response', null] }, 1, 0] } }
        }
      }
    ]);
    
    return stats[0] || {
      averageRating: 0,
      totalReviews: 0,
      verifiedCount: 0,
      withImagesCount: 0,
      withResponseCount: 0
    };
  };

  // Get rating breakdown for a product
  schema.statics.getRatingBreakdown = async function(productId) {
    const breakdown = await this.aggregate([
      { $match: { productId: new mongoose.Types.ObjectId(productId), status: 'approved' } },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: -1 } }
    ]);
    
    const result = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    breakdown.forEach(item => {
      result[item._id] = item.count;
    });
    
    // Add percentages
    const total = Object.values(result).reduce((a, b) => a + b, 0);
    const percentages = {};
    if (total > 0) {
      Object.keys(result).forEach(rating => {
        percentages[rating] = (result[rating] / total) * 100;
      });
    }
    
    return {
      counts: result,
      percentages,
      total
    };
  };

  // Get reviews for a product with pagination
  schema.statics.getProductReviews = async function(productId, options = {}) {
    const {
      limit = 20,
      skip = 0,
      sortBy = 'createdAt',
      sortOrder = -1,
      rating = null,
      verifiedOnly = false,
      withImagesOnly = false,
      userId = null
    } = options;

    const query = { 
      productId: new mongoose.Types.ObjectId(productId),
      status: REVIEW_STATUS.APPROVED
    };

    if (rating) {
      query.rating = rating;
    }

    if (verifiedOnly) {
      query.verifiedPurchase = true;
    }

    if (withImagesOnly) {
      query.images = { $ne: [] };
    }

    const sort = {};
    sort[sortBy] = sortOrder;

    const reviews = await this.find(query)
      .populate('userId', 'username displayName avatar')
      .populate('helpfulBy', 'username')
      .sort(sort)
      .limit(limit)
      .skip(skip)
      .lean();

    const formattedReviews = reviews.map(review => formatReviewResponse(review, userId));

    const total = await this.countDocuments(query);

    return {
      reviews: formattedReviews,
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + reviews.length < total
      }
    };
  };

  // Get reviews by user
  schema.statics.getUserReviews = async function(userId, options = {}) {
    const { limit = 20, skip = 0, status = null } = options;

    const query = { userId };

    if (status) {
      query.status = status;
    }

    const reviews = await this.find(query)
      .populate('productId', 'name slug images')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    const total = await this.countDocuments(query);

    return {
      reviews,
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + reviews.length < total
      }
    };
  };

  // Get flagged reviews (for moderation)
  schema.statics.getFlaggedReviews = async function(options = {}) {
    const { limit = 50, skip = 0 } = options;

    const reviews = await this.find({ 
      status: REVIEW_STATUS.FLAGGED,
      reportCount: { $gt: 0 }
    })
      .populate('userId', 'username email')
      .populate('productId', 'name')
      .populate('reportedBy.user', 'username')
      .sort({ reportCount: -1, createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    const total = await this.countDocuments({ 
      status: REVIEW_STATUS.FLAGGED,
      reportCount: { $gt: 0 }
    });

    return {
      reviews,
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + reviews.length < total
      }
    };
  };

  // Get pending reviews (for moderation)
  schema.statics.getPendingReviews = async function(options = {}) {
    const { limit = 50, skip = 0 } = options;

    const reviews = await this.find({ status: REVIEW_STATUS.PENDING })
      .populate('userId', 'username email')
      .populate('productId', 'name')
      .sort({ createdAt: 1 })
      .limit(limit)
      .skip(skip)
      .lean();

    const total = await this.countDocuments({ status: REVIEW_STATUS.PENDING });

    return {
      reviews,
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + reviews.length < total
      }
    };
  };

  // Check if user has already reviewed a product
  schema.statics.hasUserReviewed = async function(userId, productId) {
    const review = await this.findOne({
      userId,
      productId,
      status: { $ne: 'rejected' }
    });
    
    return !!review;
  };

  // Get user's review for a specific product
  schema.statics.getUserProductReview = async function(userId, productId) {
    return this.findOne({
      userId,
      productId
    }).populate('productId', 'name slug images');
  };

  // Bulk update status (admin)
  schema.statics.bulkUpdateStatus = async function(reviewIds, status, moderatedBy) {
    const result = await this.updateMany(
      { _id: { $in: reviewIds } },
      {
        $set: {
          status,
          moderatedBy,
          moderatedAt: new Date()
        }
      }
    );

    return {
      modifiedCount: result.modifiedCount,
      message: `${result.modifiedCount} reviews updated to ${status}`
    };
  };

  // Get review statistics
  schema.statics.getStats = async function() {
    const stats = await this.aggregate([
      { $match: { status: { $ne: 'rejected' } } },
      {
        $facet: {
          byStatus: [
            { $group: { _id: '$status', count: { $sum: 1 } } }
          ],
          byRating: [
            { $group: { _id: '$rating', count: { $sum: 1 } } }
          ],
          overview: [
            {
              $group: {
                _id: null,
                totalReviews: { $sum: 1 },
                averageRating: { $avg: '$rating' },
                totalHelpful: { $sum: '$helpfulCount' },
                totalReports: { $sum: '$reportCount' },
                verifiedReviews: { $sum: { $cond: ['$verifiedPurchase', 1, 0] } }
              }
            }
          ]
        }
      }
    ]);

    return stats[0];
  };
};
