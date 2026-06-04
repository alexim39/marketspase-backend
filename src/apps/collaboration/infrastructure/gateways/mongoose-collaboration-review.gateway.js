import mongoose from 'mongoose';
import { NotificationService } from '../../../notification/services/notification.service.js';
import { UserModel } from '../../../user/models/user/index.js';
import { CollaborationReviewModel } from '../../models/index.js';
import { getReviewEligibility, recomputeCollaborationRating } from '../../services/collaboration-review.service.js';
import { CollaborationReviewGateway } from '../../application/ports/collaboration-review.gateway.js';

const buildPagination = async ({ query, page, limit }) => {
  const total = await CollaborationReviewModel.countDocuments(query);
  return {
    total,
    page,
    limit,
    totalPages: Math.max(Math.ceil(total / limit), 1),
  };
};

const toSummaryNumbers = (summary = {}) => ({
  averageRating: Number(summary.averageRating || 0),
  totalReviews: Number(summary.totalReviews || 0),
  flagged: Number(summary.flagged || 0),
});

const toAdminSummaryNumbers = (summary = {}) => ({
  totalReviews: Number(summary.totalReviews || 0),
  published: Number(summary.published || 0),
  flagged: Number(summary.flagged || 0),
  hidden: Number(summary.hidden || 0),
  removed: Number(summary.removed || 0),
});

export class MongooseCollaborationReviewGateway extends CollaborationReviewGateway {
  isValidObjectId(value) {
    return mongoose.Types.ObjectId.isValid(value);
  }

  async getReviewEligibility(query = {}) {
    return getReviewEligibility(query);
  }

  async listReceivedReviews({ userId, page, limit, includeHidden = false } = {}) {
    const skip = (page - 1) * limit;
    const query = {
      reviewee: new mongoose.Types.ObjectId(userId),
      ...(includeHidden ? {} : { status: { $in: ['published', 'flagged'] } }),
    };

    const [reviews, pagination, summary] = await Promise.all([
      CollaborationReviewModel.find(query)
        .populate('reviewer', 'displayName username avatar role isVerified')
        .populate('campaign', 'title status')
        .populate('promotion', 'upi status')
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
            averageRating: { $avg: '$rating' },
            totalReviews: { $sum: 1 },
            flagged: {
              $sum: {
                $cond: [{ $eq: ['$status', 'flagged'] }, 1, 0],
              },
            },
          },
        },
      ]),
    ]);

    return {
      reviews,
      pagination,
      summary: toSummaryNumbers(summary[0]),
    };
  }

  async listGivenReviews({ userId, page, limit } = {}) {
    const skip = (page - 1) * limit;
    const query = {
      reviewer: new mongoose.Types.ObjectId(userId),
    };

    const [reviews, pagination] = await Promise.all([
      CollaborationReviewModel.find(query)
        .populate('reviewee', 'displayName username avatar role isVerified')
        .populate('campaign', 'title status')
        .populate('promotion', 'upi status')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      buildPagination({ query, page, limit }),
    ]);

    return {
      reviews,
      pagination,
    };
  }

  async listAdminReviews({ page, limit, search = '', status = 'all', flaggedOnly = false } = {}) {
    const skip = (page - 1) * limit;
    const query = {};

    if (status !== 'all') {
      query.status = status;
    }

    if (flaggedOnly) {
      query.flagCount = { $gt: 0 };
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { comment: { $regex: search, $options: 'i' } },
      ];
    }

    const [reviews, pagination, summary] = await Promise.all([
      CollaborationReviewModel.find(query)
        .populate('reviewer', 'displayName username avatar role')
        .populate('reviewee', 'displayName username avatar role')
        .populate('campaign', 'title status')
        .populate('promotion', 'upi status')
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
              $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] },
            },
            flagged: {
              $sum: { $cond: [{ $eq: ['$status', 'flagged'] }, 1, 0] },
            },
            hidden: {
              $sum: { $cond: [{ $eq: ['$status', 'hidden'] }, 1, 0] },
            },
            removed: {
              $sum: { $cond: [{ $eq: ['$status', 'removed'] }, 1, 0] },
            },
          },
        },
      ]),
    ]);

    return {
      reviews,
      pagination,
      summary: toAdminSummaryNumbers(summary[0]),
    };
  }

  async createReview({
    reviewerId,
    revieweeId,
    campaignId = null,
    promotionId = null,
    relationshipType,
    rating,
    title = '',
    comment = '',
    status = 'published',
    publishedAt = new Date(),
  } = {}) {
    return CollaborationReviewModel.create({
      reviewer: reviewerId,
      reviewee: revieweeId,
      campaign: campaignId,
      promotion: promotionId,
      relationshipType,
      rating,
      title,
      comment,
      status,
      publishedAt,
    });
  }

  async getReviewById(reviewId) {
    return CollaborationReviewModel.findById(reviewId)
      .populate('reviewer', 'displayName username avatar role isVerified')
      .populate('reviewee', 'displayName username avatar role isVerified')
      .populate('campaign', 'title status')
      .populate('promotion', 'upi status')
      .lean();
  }

  async recomputeCollaborationRating(userId) {
    return recomputeCollaborationRating(userId);
  }

  async notifyReviewReceived(userId, review) {
    return NotificationService.createReviewReceivedNotification(userId, review);
  }

  async findReviewForFlag(reviewId) {
    return CollaborationReviewModel.findById(reviewId)
      .populate('reviewer', 'displayName username')
      .populate('reviewee', 'displayName username')
      .populate('campaign', 'title')
      .populate('promotion', 'upi')
      .lean();
  }

  async flagReview({ reviewId, userId, reason, details = '', currentStatus } = {}) {
    return CollaborationReviewModel.findByIdAndUpdate(
      reviewId,
      {
        $push: {
          flags: {
            user: userId,
            reason,
            details,
            createdAt: new Date(),
          },
        },
        $inc: { flagCount: 1 },
        $set: {
          status: currentStatus === 'removed' ? 'removed' : 'flagged',
        },
      },
      { new: true },
    )
      .populate('reviewer', 'displayName username')
      .populate('reviewee', 'displayName username')
      .populate('campaign', 'title')
      .populate('promotion', 'upi')
      .lean();
  }

  async getAdminNotificationRecipients() {
    return UserModel.find({ role: { $in: ['admin', 'super-admin'] } })
      .select('_id')
      .lean();
  }

  async notifyReviewFlagged(adminId, review, reason) {
    return NotificationService.createReviewFlaggedAdminNotification(adminId, review, reason);
  }

  async findReviewById(reviewId) {
    return CollaborationReviewModel.findById(reviewId).lean();
  }

  async updateReviewModeration({ reviewId, update = {} } = {}) {
    return CollaborationReviewModel.findByIdAndUpdate(
      reviewId,
      { $set: update },
      { new: true },
    )
      .populate('reviewer', 'displayName username avatar role')
      .populate('reviewee', 'displayName username avatar role')
      .populate('campaign', 'title status')
      .populate('promotion', 'upi status')
      .lean();
  }
}
