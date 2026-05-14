import mongoose from 'mongoose';
import { UserModel } from '../models/user/index.js';
import { FollowModel } from '../../profile/models/follow/index.js';
import { FeedPostModel } from '../../feeds/models/feed/index.js';
import { ThreadModel } from '../../forum/models/thread/thread.model.js';
import { CommentModel } from '../../forum/models/comment/comment.model.js';
import { CampaignModel } from '../../campaign/models/campaign.model.js';
import { PromotionModel } from '../../promotion/models/promotion.model.js';
import { PromotionTrackingModel } from '../../store/models/promotion/promotion/promotionTracking.model.js';
import { StoreModel } from '../../store/models/store/store.model.js';
import { ProductModel } from '../../store/models/promotion/product/product.model.js';
import { OrderModel } from '../../store/models/order/order.model.js';

const toObjectId = (value) => (
  mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : null
);

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const normalize = (value, target) => {
  const safeValue = Number(value || 0);
  if (!Number.isFinite(safeValue) || safeValue <= 0 || !target) {
    return 0;
  }

  return clamp(safeValue / target, 0, 1);
};

const average = (values) => {
  const valid = values.filter((value) => Number.isFinite(value));
  if (valid.length === 0) {
    return 0;
  }

  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
};

const roundRating = (value) => {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.round(value * 10) / 10;
};

const calculateSharedSignals = ({
  followersCount,
  postsCount,
  threadCount,
  commentCount,
  totalEngagements,
  streakDays,
  level,
}) => {
  const communityVolume = postsCount + threadCount + commentCount;

  return {
    followerScore: normalize(followersCount, 100),
    engagementScore: normalize(totalEngagements, 250),
    communityScore: normalize(communityVolume, 25),
    consistencyScore: normalize(streakDays, 14),
    gamificationScore: normalize(level, 15),
    signalCount:
      Number(followersCount || 0) +
      Number(postsCount || 0) +
      Number(threadCount || 0) +
      Number(commentCount || 0) +
      Number(streakDays || 0),
  };
};

const calculateMarketerScore = ({
  totalOrders,
  totalSalesAmount,
  totalCampaignClicks,
  averageProductRating,
  ratedProducts,
  storeCount,
  totalProducts,
}) => {
  const score = average([
    normalize(totalOrders, 25),
    normalize(totalSalesAmount, 500000),
    normalize(totalCampaignClicks, 1500),
    ratedProducts > 0
      ? clamp(Number(averageProductRating || 0) / 5, 0, 1)
      : normalize(totalProducts, 12) * 0.6,
    normalize(storeCount, 3),
  ]);

  const signalCount =
    Number(totalOrders || 0) +
    Number(totalProducts || 0) +
    Number(ratedProducts || 0) +
    Number(storeCount || 0);

  return { score, signalCount };
};

const calculatePromoterScore = ({
  totalAcceptedCampaigns,
  totalBillableCampaignClicks,
  totalAffiliateSales,
  totalCommissionEarned,
  totalAttributedSales,
}) => {
  const score = average([
    normalize(totalAcceptedCampaigns, 12),
    normalize(totalBillableCampaignClicks, 500),
    normalize(totalAffiliateSales + totalAttributedSales, 25),
    normalize(totalCommissionEarned, 150000),
  ]);

  const signalCount =
    Number(totalAcceptedCampaigns || 0) +
    Number(totalAffiliateSales || 0) +
    Number(totalAttributedSales || 0);

  return { score, signalCount };
};

export const buildUserReputationSnapshot = async (userLike) => {
  const userId = toObjectId(userLike?._id || userLike);
  if (!userId) {
    return {
      rating: 0,
      ratingCount: 0,
      recalculatedAt: new Date(),
    };
  }

  const baseUser = userLike?._id
    ? userLike
    : await UserModel.findById(userId)
        .select('role loginStreak gamificationProfile')
        .lean();

  if (!baseUser) {
    return {
      rating: 0,
      ratingCount: 0,
      recalculatedAt: new Date(),
    };
  }

  const [
    followersCount,
    feedStats,
    forumThreadStats,
    forumCommentStats,
    marketerMetrics,
    promoterMetrics,
  ] = await Promise.all([
    FollowModel.countDocuments({ following: userId }),
    FeedPostModel.aggregate([
      { $match: { author: userId, status: 'published' } },
      {
        $project: {
          likesCount: { $size: { $ifNull: ['$likes', []] } },
          commentsCount: { $size: { $ifNull: ['$comments', []] } },
          sharesCount: { $size: { $ifNull: ['$shares', []] } },
        }
      },
      {
        $group: {
          _id: null,
          postsCount: { $sum: 1 },
          totalLikes: { $sum: '$likesCount' },
          totalComments: { $sum: '$commentsCount' },
          totalShares: { $sum: '$sharesCount' },
        }
      }
    ]),
    ThreadModel.aggregate([
      {
        $match: {
          author: userId,
          isDeleted: { $ne: true },
        }
      },
      {
        $group: {
          _id: null,
          threadCount: { $sum: 1 },
          totalThreadLikes: { $sum: '$likeCount' },
          totalThreadComments: { $sum: '$commentCount' },
        }
      }
    ]),
    CommentModel.aggregate([
      {
        $match: {
          author: userId,
          isDeleted: { $ne: true },
        }
      },
      {
        $group: {
          _id: null,
          commentCount: { $sum: 1 },
          totalCommentLikes: { $sum: '$likeCount' },
        }
      }
    ]),
    baseUser.role === 'marketer'
      ? (async () => {
          const stores = await StoreModel.find({
            owner: userId,
            isDeleted: { $ne: true },
          })
            .select('_id')
            .lean();

          const storeIds = stores.map((store) => store._id);

          const [
            campaignMetrics,
            productMetrics,
            orderMetrics,
          ] = await Promise.all([
            CampaignModel.aggregate([
              {
                $match: {
                  owner: userId,
                  isDeleted: { $ne: true },
                }
              },
              {
                $group: {
                  _id: null,
                  totalCampaignClicks: { $sum: '$totalClicks' },
                }
              }
            ]),
            storeIds.length > 0
              ? ProductModel.aggregate([
                  {
                    $match: {
                      store: { $in: storeIds },
                      isDeleted: { $ne: true },
                    }
                  },
                  {
                    $group: {
                      _id: null,
                      totalProducts: { $sum: 1 },
                      ratedProducts: {
                        $sum: {
                          $cond: [{ $gt: ['$ratingCount', 0] }, 1, 0]
                        }
                      },
                      weightedRatingSum: {
                        $sum: {
                          $multiply: [
                            { $ifNull: ['$averageRating', 0] },
                            { $ifNull: ['$ratingCount', 0] }
                          ]
                        }
                      },
                      totalRatingVotes: { $sum: { $ifNull: ['$ratingCount', 0] } }
                    }
                  }
                ])
              : Promise.resolve([]),
            storeIds.length > 0
              ? OrderModel.aggregate([
                  {
                    $match: {
                      store: { $in: storeIds },
                      paymentStatus: 'paid',
                      isDeleted: { $ne: true },
                    }
                  },
                  {
                    $group: {
                      _id: null,
                      totalOrders: { $sum: 1 },
                      totalSalesAmount: { $sum: '$totalAmount' },
                    }
                  }
                ])
              : Promise.resolve([]),
          ]);

          const campaignData = campaignMetrics[0] || {};
          const productData = productMetrics[0] || {};
          const orderData = orderMetrics[0] || {};
          const totalRatingVotes = Number(productData.totalRatingVotes || 0);

          return {
            storeCount: stores.length,
            totalProducts: Number(productData.totalProducts || 0),
            ratedProducts: Number(productData.ratedProducts || 0),
            averageProductRating: totalRatingVotes > 0
              ? Number(productData.weightedRatingSum || 0) / totalRatingVotes
              : 0,
            totalOrders: Number(orderData.totalOrders || 0),
            totalSalesAmount: Number(orderData.totalSalesAmount || 0),
            totalCampaignClicks: Number(campaignData.totalCampaignClicks || 0),
          };
        })()
      : Promise.resolve(null),
    baseUser.role === 'promoter'
      ? Promise.all([
          PromotionModel.aggregate([
            { $match: { promoter: userId } },
            {
              $group: {
                _id: null,
                totalAcceptedCampaigns: { $sum: 1 },
                totalBillableCampaignClicks: { $sum: '$clickStats.billableClicks' },
              }
            }
          ]),
          PromotionTrackingModel.aggregate([
            { $match: { promoter: userId } },
            {
              $group: {
                _id: null,
                totalAffiliateSales: { $sum: '$conversionCount' },
                totalCommissionEarned: { $sum: '$earnings' },
              }
            }
          ]),
          OrderModel.aggregate([
            {
              $match: {
                paymentStatus: 'paid',
                isDeleted: { $ne: true },
                'items.promoterId': userId,
              }
            },
            { $unwind: '$items' },
            { $match: { 'items.promoterId': userId } },
            {
              $group: {
                _id: null,
                totalAttributedSales: { $sum: 1 },
              }
            }
          ]),
        ]).then(([campaignMetrics, affiliateMetrics, orderMetrics]) => ({
          totalAcceptedCampaigns: Number(campaignMetrics[0]?.totalAcceptedCampaigns || 0),
          totalBillableCampaignClicks: Number(campaignMetrics[0]?.totalBillableCampaignClicks || 0),
          totalAffiliateSales: Number(affiliateMetrics[0]?.totalAffiliateSales || 0),
          totalCommissionEarned: Number(affiliateMetrics[0]?.totalCommissionEarned || 0),
          totalAttributedSales: Number(orderMetrics[0]?.totalAttributedSales || 0),
        }))
      : Promise.resolve(null),
  ]);

  const feedData = feedStats[0] || {};
  const threadData = forumThreadStats[0] || {};
  const commentData = forumCommentStats[0] || {};
  const totalEngagements =
    Number(feedData.totalLikes || 0) +
    Number(feedData.totalComments || 0) +
    Number(feedData.totalShares || 0) +
    Number(threadData.totalThreadLikes || 0) +
    Number(threadData.totalThreadComments || 0) +
    Number(commentData.totalCommentLikes || 0);

  const shared = calculateSharedSignals({
    followersCount,
    postsCount: Number(feedData.postsCount || 0),
    threadCount: Number(threadData.threadCount || 0),
    commentCount: Number(commentData.commentCount || 0),
    totalEngagements,
    streakDays: Number(baseUser.loginStreak?.currentStreak || 0),
    level: Number(baseUser.gamificationProfile?.currentLevel || 0),
  });

  let roleScore = 0;
  let roleSignals = 0;

  if (baseUser.role === 'marketer' && marketerMetrics) {
    const marketer = calculateMarketerScore(marketerMetrics);
    roleScore = marketer.score;
    roleSignals = marketer.signalCount;
  } else if (baseUser.role === 'promoter' && promoterMetrics) {
    const promoter = calculatePromoterScore(promoterMetrics);
    roleScore = promoter.score;
    roleSignals = promoter.signalCount;
  }

  const sharedScore = average([
    shared.followerScore,
    shared.engagementScore,
    shared.communityScore,
    shared.consistencyScore,
    shared.gamificationScore,
  ]);

  const weightedScore = roleScore > 0
    ? (sharedScore * 0.4) + (roleScore * 0.6)
    : sharedScore;

  const rating = weightedScore > 0
    ? roundRating(Math.max(1, weightedScore * 5))
    : 0;

  return {
    rating,
    ratingCount: Math.round(shared.signalCount + roleSignals),
    recalculatedAt: new Date(),
  };
};

export const refreshUserReputation = async (userLike) => {
  const userId = toObjectId(userLike?._id || userLike);
  if (!userId) {
    return {
      rating: 0,
      ratingCount: 0,
      recalculatedAt: new Date(),
    };
  }

  const snapshot = await buildUserReputationSnapshot(userLike);

  await UserModel.updateOne(
    { _id: userId },
    {
      $set: {
        rating: snapshot.rating,
        ratingCount: snapshot.ratingCount,
      }
    }
  );

  return snapshot;
};
