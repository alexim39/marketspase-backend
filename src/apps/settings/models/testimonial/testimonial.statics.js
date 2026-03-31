import { TESTIMONIAL_STATUS } from "./testimonial.constants.js";
import { formatTestimonialResponse } from "./testimonial.utils.js";

export const setupTestimonialStatics = (schema) => {
  // Get approved testimonials with pagination
  schema.statics.getApproved = async function(options = {}) {
    const { 
      limit = 20, 
      skip = 0, 
      featured = null,
      minRating = null,
      userId = null 
    } = options;

    const query = { 
      status: TESTIMONIAL_STATUS.APPROVED,
      isDeleted: false 
    };

    if (featured !== null) {
      query.isFeatured = featured;
    }

    if (minRating) {
      query.rating = { $gte: minRating };
    }

    const testimonials = await this.find(query)
      .populate('user', 'username displayName avatar')
      .sort({ isFeatured: -1, createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    const formattedTestimonials = testimonials.map(t => 
      formatTestimonialResponse(t, userId)
    );

    const total = await this.countDocuments(query);

    return {
      testimonials: formattedTestimonials,
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + testimonials.length < total
      }
    };
  };

  // Get testimonials by user
  schema.statics.getByUser = async function(userId, options = {}) {
    const { limit = 20, skip = 0, status = null } = options;

    const query = { 
      user: userId,
      isDeleted: false 
    };

    if (status) {
      query.status = status;
    }

    const testimonials = await this.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    const formattedTestimonials = testimonials.map(t => 
      formatTestimonialResponse(t, userId)
    );

    const total = await this.countDocuments(query);

    return {
      testimonials: formattedTestimonials,
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + testimonials.length < total
      }
    };
  };

  // Get pending testimonials (for moderation)
  schema.statics.getPending = async function(options = {}) {
    const { limit = 50, skip = 0 } = options;

    const testimonials = await this.find({ 
      status: TESTIMONIAL_STATUS.PENDING,
      isDeleted: false 
    })
      .populate('user', 'username displayName email')
      .sort({ createdAt: 1 })
      .limit(limit)
      .skip(skip)
      .lean();

    const total = await this.countDocuments({ 
      status: TESTIMONIAL_STATUS.PENDING,
      isDeleted: false 
    });

    return {
      testimonials,
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + testimonials.length < total
      }
    };
  };

  // Get featured testimonials
  schema.statics.getFeatured = async function(limit = 10) {
    return this.getApproved({ featured: true, limit });
  };

  // Get testimonial statistics
  schema.statics.getStats = async function() {
    const stats = await this.aggregate([
      { $match: { isDeleted: false } },
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
                total: { $sum: 1 },
                totalLikes: { $sum: '$likes' },
                totalDislikes: { $sum: '$dislikes' },
                avgRating: { $avg: '$rating' },
                featured: { $sum: { $cond: ['$isFeatured', 1, 0] } }
              }
            }
          ]
        }
      }
    ]);

    return stats[0];
  };

  // Search testimonials
  schema.statics.search = async function(query, options = {}) {
    const { limit = 20, skip = 0, status = null } = options;

    const searchQuery = {
      $text: { $search: query },
      isDeleted: false
    };

    if (status) {
      searchQuery.status = status;
    }

    const testimonials = await this.find(searchQuery)
      .populate('user', 'username displayName avatar')
      .sort({ score: { $meta: 'textScore' } })
      .limit(limit)
      .skip(skip)
      .lean();

    const total = await this.countDocuments(searchQuery);

    return {
      testimonials,
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + testimonials.length < total
      }
    };
  };

  // Get top testimonials by likes
  schema.statics.getTopLiked = async function(limit = 10) {
    return this.find({ 
      status: TESTIMONIAL_STATUS.APPROVED,
      isDeleted: false 
    })
      .sort({ likes: -1, createdAt: -1 })
      .limit(limit)
      .populate('user', 'username displayName avatar')
      .lean();
  };

  // Bulk update status (admin)
  schema.statics.bulkUpdateStatus = async function(testimonialIds, status, reviewedBy) {
    const result = await this.updateMany(
      { _id: { $in: testimonialIds } },
      {
        $set: {
          status,
          reviewedBy,
          reviewedAt: new Date()
        }
      }
    );

    return {
      modifiedCount: result.modifiedCount,
      message: `${result.modifiedCount} testimonials updated to ${status}`
    };
  };
};