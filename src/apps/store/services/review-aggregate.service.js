import mongoose from 'mongoose';
import { ReviewModel } from '../models/review/index.js';
import { ProductModel } from '../models/promotion/index.js';

const toObjectId = (value) => (
  mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : null
);

const roundRating = (value) => {
  const next = Number(value || 0);
  if (!Number.isFinite(next) || next <= 0) {
    return 0;
  }

  return Math.round(next * 10) / 10;
};

export const getProductReviewStats = async (productId) => {
  const objectId = toObjectId(productId);
  if (!objectId) {
    return {
      averageRating: 0,
      totalReviews: 0,
    };
  }

  const [stats] = await ReviewModel.aggregate([
    {
      $match: {
        productId: objectId,
        status: 'approved',
      }
    },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 },
      }
    }
  ]);

  return {
    averageRating: roundRating(stats?.averageRating),
    totalReviews: Number(stats?.totalReviews || 0),
  };
};

export const syncProductReviewStats = async (productId) => {
  const stats = await getProductReviewStats(productId);

  const objectId = toObjectId(productId);
  if (objectId) {
    await ProductModel.findByIdAndUpdate(objectId, {
      $set: {
        averageRating: stats.averageRating,
        ratingCount: stats.totalReviews,
      }
    });
  }

  return stats;
};

export const getStoreReviewStats = async (storeId) => {
  const objectId = toObjectId(storeId);
  if (!objectId) {
    return {
      averageRating: 0,
      totalReviews: 0,
    };
  }

  const [stats] = await ReviewModel.aggregate([
    {
      $match: {
        storeId: objectId,
        status: 'approved',
      }
    },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 },
      }
    }
  ]);

  return {
    averageRating: roundRating(stats?.averageRating),
    totalReviews: Number(stats?.totalReviews || 0),
  };
};

export const mergeStoreRatingAnalytics = (storeLike, reviewStats = null) => {
  const store = storeLike?.toObject ? storeLike.toObject() : { ...(storeLike || {}) };
  const ratingStats = reviewStats || {
    averageRating: 0,
    totalReviews: 0,
  };

  return {
    ...store,
    analytics: {
      ...(store.analytics || {}),
      rating: ratingStats.averageRating,
      totalReviews: ratingStats.totalReviews,
      ratingCount: ratingStats.totalReviews,
    },
  };
};
