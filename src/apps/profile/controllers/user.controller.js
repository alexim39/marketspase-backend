import mongoose from 'mongoose';
import { UserModel } from '../../user/models/user/index.js';
import { FollowModel } from '../models/follow/index.js';
import { FeedPostModel } from '../../feeds/models/feed/index.js';
import { CampaignModel } from '../../campaign/models/campaign.model.js';
import { ProductModel } from '../../store/models/promotion/product/product.model.js';
import { StoreModel } from '../../store/models/store/store.model.js';
import { OrderModel } from '../../store/models/order/order.model.js';
import { PromotionTrackingModel } from '../../store/models/promotion/promotion/promotionTracking.model.js';
import { PromotionModel } from '../../promotion/models/promotion.model.js';
import { normalizePromotionTrackingFields } from '../../promotion/utils/promotion-url.js';
import { ThreadModel } from '../../forum/models/thread/thread.model.js';
import { CommentModel } from '../../forum/models/comment/comment.model.js';
import { refreshUserReputation } from '../../user/services/user-reputation.service.js';

const PROFILE_WINDOW_DAYS = 30;
const PROFILE_TOP_LIMIT = 4;

const toObjectId = (value) => (
  mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : null
);

const sanitizeString = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
};

const compactSocialProfiles = (profiles = {}) => {
  if (!profiles || typeof profiles !== 'object') {
    return {};
  }

  return Object.fromEntries(
    Object.entries(profiles)
      .map(([key, value]) => [key, sanitizeString(value)])
      .filter(([, value]) => Boolean(value))
  );
};

const isSummaryProfileView = (value) => ['summary', 'dashboard', 'compact'].includes(String(value || '').trim().toLowerCase());

const sumStoreValues = (stores, selector) => stores.reduce((total, store) => total + Number(selector(store) || 0), 0);

const buildMarketerProfile = async (userObjectId, user, sinceDate) => {
  const stores = await StoreModel.find({
    owner: userObjectId,
    isDeleted: { $ne: true },
  })
    .select('_id name description logo category storeLink isVerified analytics followers activeCampaigns')
    .sort({ createdAt: -1 })
    .lean();

  const storeIds = stores.map((store) => store._id);

  const [
    topCampaigns,
    topProducts,
    campaignLifetime,
    totalProducts,
    recentCampaignsCreated,
    recentProductsUploaded,
    salesLifetime,
    recentSales,
  ] = await Promise.all([
    CampaignModel.find({
      owner: userObjectId,
      isDeleted: { $ne: true },
    })
      .sort({ billableClicks: -1, totalClicks: -1, createdAt: -1 })
      .limit(PROFILE_TOP_LIMIT)
      .select('title category status mediaUrl thumbnailUrl budget spentBudget totalClicks billableClicks costPerClick createdAt')
      .lean(),
    storeIds.length > 0
      ? ProductModel.find({
          store: { $in: storeIds },
          isDeleted: { $ne: true },
          isActive: { $ne: false },
        })
          .sort({ purchaseCount: -1, viewCount: -1, createdAt: -1 })
          .limit(PROFILE_TOP_LIMIT)
          .select('name category price currency images purchaseCount viewCount averageRating ratingCount isPublished createdAt')
          .lean()
      : Promise.resolve([]),
    CampaignModel.aggregate([
      {
        $match: {
          owner: userObjectId,
          isDeleted: { $ne: true },
        }
      },
      {
        $group: {
          _id: null,
          totalCampaigns: { $sum: 1 },
          totalCampaignClicks: { $sum: '$totalClicks' },
          totalBillableClicks: { $sum: '$billableClicks' },
          totalCampaignSpend: { $sum: '$spentBudget' },
        }
      }
    ]),
    storeIds.length > 0
      ? ProductModel.countDocuments({
          store: { $in: storeIds },
          isDeleted: { $ne: true },
        })
      : Promise.resolve(0),
    CampaignModel.countDocuments({
      owner: userObjectId,
      isDeleted: { $ne: true },
      createdAt: { $gte: sinceDate },
    }),
    storeIds.length > 0
      ? ProductModel.countDocuments({
          store: { $in: storeIds },
          isDeleted: { $ne: true },
          createdAt: { $gte: sinceDate },
        })
      : Promise.resolve(0),
    storeIds.length > 0
      ? OrderModel.aggregate([
          {
            $match: {
              store: { $in: storeIds },
              isDeleted: { $ne: true },
              paymentStatus: 'paid',
            }
          },
          {
            $group: {
              _id: null,
              totalOrders: { $sum: 1 },
              totalSalesAmount: { $sum: '$totalAmount' },
              pendingEscrowAmount: {
                $sum: {
                  $cond: [
                    { $in: ['$escrowStatus', ['pending', 'held']] },
                    '$marketerReservedAmount',
                    0
                  ]
                }
              }
            }
          }
        ])
      : Promise.resolve([]),
    storeIds.length > 0
      ? OrderModel.aggregate([
          {
            $match: {
              store: { $in: storeIds },
              isDeleted: { $ne: true },
              paymentStatus: 'paid',
              placedAt: { $gte: sinceDate },
            }
          },
          {
            $group: {
              _id: null,
              recentOrders: { $sum: 1 },
              recentSalesAmount: { $sum: '$totalAmount' }
            }
          }
        ])
      : Promise.resolve([]),
  ]);

  const campaignLifetimeSummary = campaignLifetime[0] || {};
  const salesLifetimeSummary = salesLifetime[0] || {};
  const recentSalesSummary = recentSales[0] || {};

  const totalViews = sumStoreValues(stores, (store) => store.analytics?.totalViews);
  const totalStoreSales = sumStoreValues(stores, (store) => store.analytics?.totalSales);
  const totalStoreFollowers = stores.reduce((total, store) => total + (Array.isArray(store.followers) ? store.followers.length : 0), 0);
  const totalPromoterTraffic = sumStoreValues(stores, (store) => store.analytics?.promoterTraffic);
  const totalActiveCampaigns = stores.reduce((total, store) => total + (Array.isArray(store.activeCampaigns) ? store.activeCampaigns.length : 0), 0);
  const aggregateConversionRate = totalViews > 0
    ? Number(((totalStoreSales / totalViews) * 100).toFixed(2))
    : 0;

  return {
    businessOverview: {
      brandName: sanitizeString(user?.professionalInfo?.businessProfile?.brandName) || sanitizeString(stores[0]?.name) || sanitizeString(user?.displayName),
      brandSummary: sanitizeString(user?.professionalInfo?.businessProfile?.brandSummary)
        || sanitizeString(user?.personalInfo?.biography)
        || sanitizeString(stores[0]?.description),
      uniqueSellingPoints: Array.isArray(user?.professionalInfo?.businessProfile?.uniqueSellingPoints)
        ? user.professionalInfo.businessProfile.uniqueSellingPoints.filter(Boolean).slice(0, 8)
        : [],
      socialProfiles: compactSocialProfiles(user?.professionalInfo?.socialProfiles),
      primaryStore: stores[0]
        ? {
            _id: stores[0]._id,
            name: stores[0].name,
            logo: stores[0].logo || null,
            category: stores[0].category || null,
            storeLink: stores[0].storeLink || null,
            isVerified: Boolean(stores[0].isVerified),
          }
        : null,
    },
    storeSummary: {
      storeCount: stores.length,
      totalProducts,
      totalStoreFollowers,
      totalViews,
      totalSales: totalStoreSales,
      conversionRate: aggregateConversionRate,
      promoterTraffic: totalPromoterTraffic,
      activeCampaigns: totalActiveCampaigns,
    },
    analytics: {
      totalCampaigns: campaignLifetimeSummary.totalCampaigns || 0,
      totalCampaignClicks: campaignLifetimeSummary.totalCampaignClicks || 0,
      totalBillableClicks: campaignLifetimeSummary.totalBillableClicks || 0,
      totalCampaignSpend: campaignLifetimeSummary.totalCampaignSpend || 0,
      totalOrders: salesLifetimeSummary.totalOrders || 0,
      totalSalesAmount: salesLifetimeSummary.totalSalesAmount || 0,
      pendingEscrowAmount: salesLifetimeSummary.pendingEscrowAmount || 0,
    },
    performance: {
      periodDays: PROFILE_WINDOW_DAYS,
      recentCampaignsCreated,
      recentProductsUploaded,
      recentOrders: recentSalesSummary.recentOrders || 0,
      recentSalesAmount: recentSalesSummary.recentSalesAmount || 0,
    },
    topCampaigns: topCampaigns.map((campaign) => ({
      _id: campaign._id,
      title: campaign.title,
      category: campaign.category,
      status: campaign.status,
      mediaUrl: campaign.mediaUrl || null,
      thumbnailUrl: campaign.thumbnailUrl || null,
      budget: campaign.budget || 0,
      spentBudget: campaign.spentBudget || 0,
      totalClicks: campaign.totalClicks || 0,
      billableClicks: campaign.billableClicks || 0,
      costPerClick: campaign.costPerClick || 0,
      createdAt: campaign.createdAt,
    })),
    topProducts: topProducts.map((product) => ({
      _id: product._id,
      name: product.name,
      category: product.category,
      price: product.price || 0,
      currency: product.currency || 'NGN',
      image: Array.isArray(product.images) ? product.images[0]?.url || null : null,
      purchaseCount: product.purchaseCount || 0,
      viewCount: product.viewCount || 0,
      averageRating: product.averageRating || 0,
      ratingCount: product.ratingCount || 0,
      isPublished: Boolean(product.isPublished),
      createdAt: product.createdAt,
    })),
  };
};

const buildPromoterProfile = async (userObjectId, sinceDate) => {
  const [
    topCampaigns,
    topProductPromotions,
    campaignSummary,
    recentAcceptedCampaigns,
    productPromotionSummary,
    recentProductPromotionSummary,
    commissionSummary,
    recentCommissionSummary,
  ] = await Promise.all([
    PromotionModel.find({ promoter: userObjectId })
      .sort({ 'clickStats.billableClicks': -1, 'clickStats.totalClicks': -1, acceptedAt: -1 })
      .limit(PROFILE_TOP_LIMIT)
      .select('status acceptedAt promotionUrl upi clickStats payoutAmount')
      .populate('campaign', 'title category status mediaUrl thumbnailUrl')
      .lean(),
    PromotionTrackingModel.find({
      promoter: userObjectId,
      isActive: true,
    })
      .sort({ earnings: -1, conversionCount: -1, clickCount: -1, createdAt: -1 })
      .limit(PROFILE_TOP_LIMIT)
      .select('uniqueCode clickCount conversionCount earnings conversionRate averageOrderValue createdAt')
      .populate('product', 'name category price currency images')
      .populate('store', 'name logo')
      .lean(),
    PromotionModel.aggregate([
      { $match: { promoter: userObjectId } },
      {
        $group: {
          _id: null,
          totalAcceptedCampaigns: { $sum: 1 },
          totalCampaignClicks: { $sum: '$clickStats.totalClicks' },
          totalBillableCampaignClicks: { $sum: '$clickStats.billableClicks' },
          totalCampaignEarnings: { $sum: '$clickStats.earnedAmount' },
        }
      }
    ]),
    PromotionModel.countDocuments({
      promoter: userObjectId,
      acceptedAt: { $gte: sinceDate },
    }),
    PromotionTrackingModel.aggregate([
      {
        $match: {
          promoter: userObjectId,
        }
      },
      {
        $group: {
          _id: null,
          totalAffiliateClicks: { $sum: '$clickCount' },
          totalAffiliateSales: { $sum: '$conversionCount' },
          totalAffiliateEarnings: { $sum: '$earnings' },
        }
      }
    ]),
    PromotionTrackingModel.aggregate([
      {
        $match: {
          promoter: userObjectId,
          createdAt: { $gte: sinceDate },
        }
      },
      {
        $group: {
          _id: null,
          recentAffiliateClicks: { $sum: '$clickCount' },
          recentAffiliateSales: { $sum: '$conversionCount' },
          recentAffiliateEarnings: { $sum: '$earnings' },
        }
      }
    ]),
    OrderModel.aggregate([
      {
        $match: {
          paymentStatus: 'paid',
          isDeleted: { $ne: true },
          'items.promoterId': userObjectId,
        }
      },
      { $unwind: '$items' },
      { $match: { 'items.promoterId': userObjectId } },
      {
        $group: {
          _id: null,
          totalAttributedSales: { $sum: 1 },
          totalCommissionEarned: { $sum: '$items.commissionEarned' },
          pendingCommission: {
            $sum: {
              $cond: [{ $eq: ['$commissionPaid', false] }, '$items.commissionEarned', 0]
            }
          },
          releasedCommission: {
            $sum: {
              $cond: [{ $eq: ['$commissionPaid', true] }, '$items.commissionEarned', 0]
            }
          },
        }
      }
    ]),
    OrderModel.aggregate([
      {
        $match: {
          paymentStatus: 'paid',
          isDeleted: { $ne: true },
          'items.promoterId': userObjectId,
          placedAt: { $gte: sinceDate },
        }
      },
      { $unwind: '$items' },
      { $match: { 'items.promoterId': userObjectId } },
      {
        $group: {
          _id: null,
          recentAttributedSales: { $sum: 1 },
          recentCommissionEarned: { $sum: '$items.commissionEarned' },
        }
      }
    ]),
  ]);

  const campaignAnalytics = campaignSummary[0] || {};
  const productAnalytics = productPromotionSummary[0] || {};
  const recentProductAnalytics = recentProductPromotionSummary[0] || {};
  const commissionAnalytics = commissionSummary[0] || {};
  const recentCommissionAnalytics = recentCommissionSummary[0] || {};

  return {
    analytics: {
      totalAcceptedCampaigns: campaignAnalytics.totalAcceptedCampaigns || 0,
      totalCampaignClicks: campaignAnalytics.totalCampaignClicks || 0,
      totalBillableCampaignClicks: campaignAnalytics.totalBillableCampaignClicks || 0,
      totalCampaignEarnings: campaignAnalytics.totalCampaignEarnings || 0,
      totalAffiliateClicks: productAnalytics.totalAffiliateClicks || 0,
      totalAffiliateSales: productAnalytics.totalAffiliateSales || 0,
      totalAffiliateEarnings: productAnalytics.totalAffiliateEarnings || 0,
    },
    commissionSummary: {
      totalAttributedSales: commissionAnalytics.totalAttributedSales || 0,
      totalCommissionEarned: commissionAnalytics.totalCommissionEarned || 0,
      pendingCommission: commissionAnalytics.pendingCommission || 0,
      releasedCommission: commissionAnalytics.releasedCommission || 0,
    },
    performance: {
      periodDays: PROFILE_WINDOW_DAYS,
      recentAcceptedCampaigns,
      recentAffiliateClicks: recentProductAnalytics.recentAffiliateClicks || 0,
      recentAffiliateSales: recentProductAnalytics.recentAffiliateSales || 0,
      recentAffiliateEarnings: recentProductAnalytics.recentAffiliateEarnings || 0,
      recentAttributedSales: recentCommissionAnalytics.recentAttributedSales || 0,
      recentCommissionEarned: recentCommissionAnalytics.recentCommissionEarned || 0,
    },
    topCampaigns: topCampaigns.map((promotion) => {
      const normalizedPromotion = normalizePromotionTrackingFields(promotion);

      return {
        _id: promotion._id,
        campaignId: promotion.campaign?._id || null,
        title: promotion.campaign?.title || 'Campaign',
        category: promotion.campaign?.category || '',
        status: promotion.status,
        mediaUrl: promotion.campaign?.mediaUrl || null,
        thumbnailUrl: promotion.campaign?.thumbnailUrl || null,
        promotionUrl: normalizedPromotion.promotionUrl,
        upi: promotion.upi || null,
        totalClicks: promotion.clickStats?.totalClicks || 0,
        billableClicks: promotion.clickStats?.billableClicks || 0,
        earnedAmount: promotion.clickStats?.earnedAmount || 0,
        acceptedAt: promotion.acceptedAt || promotion.createdAt,
      };
    }),
    topProductPromotions: topProductPromotions.map((promotion) => ({
      _id: promotion._id,
      uniqueCode: promotion.uniqueCode,
      productId: promotion.product?._id || null,
      productName: promotion.product?.name || 'Product',
      category: promotion.product?.category || '',
      storeName: promotion.store?.name || '',
      storeLogo: promotion.store?.logo || null,
      image: Array.isArray(promotion.product?.images) ? promotion.product.images[0]?.url || null : null,
      price: promotion.product?.price || 0,
      currency: promotion.product?.currency || 'NGN',
      clickCount: promotion.clickCount || 0,
      conversionCount: promotion.conversionCount || 0,
      earnings: promotion.earnings || 0,
      conversionRate: promotion.conversionRate || 0,
      averageOrderValue: promotion.averageOrderValue || 0,
      createdAt: promotion.createdAt,
    })),
  };
};

// Get public profile of a user
export const getProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const requestedCurrentUserId = req.query.currentUserId;
    const summaryView = isSummaryProfileView(req.query.view);

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const currentUserId = req.userId || (
      mongoose.Types.ObjectId.isValid(requestedCurrentUserId) ? requestedCurrentUserId : null
    );

    const user = await UserModel.findById(userId)
      .select(summaryView
        ? 'uid username displayName avatar personalInfo professionalInfo createdAt role rating ratingCount ratingUpdatedAt isVerified badgeProfile gamificationProfile'
        : 'uid username displayName avatar personalInfo professionalInfo createdAt role rating ratingCount ratingUpdatedAt isVerified badgeProfile gamificationProfile loginStreak'
      )
      .lean();

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const sinceDate = new Date(Date.now() - PROFILE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const [feedStatsResult, followersCount, followingCount] = await Promise.all([
      FeedPostModel.aggregate([
        { $match: { author: userObjectId, status: 'published' } },
        {
          $project: {
            createdAt: 1,
            likesCount: { $size: { $ifNull: ['$likes', []] } },
            commentsCount: { $size: { $ifNull: ['$comments', []] } },
            sharesCount: { $size: { $ifNull: ['$shares', []] } },
            savesCount: { $size: { $ifNull: ['$savedBy', []] } },
          }
        },
        {
          $group: {
            _id: null,
            postsCount: { $sum: 1 },
            totalLikes: { $sum: '$likesCount' },
            totalComments: { $sum: '$commentsCount' },
            totalShares: { $sum: '$sharesCount' },
            totalSaves: { $sum: '$savesCount' },
            recentPosts: {
              $sum: {
                $cond: [{ $gte: ['$createdAt', sinceDate] }, 1, 0]
              }
            }
          }
        }
      ]),
      FollowModel.countDocuments({ following: userId }),
      FollowModel.countDocuments({ follower: userId }),
    ]);

    const feedStats = feedStatsResult[0] || {};
    const postsCount = feedStats.postsCount || 0;
    const totalLikes = feedStats.totalLikes || 0;
    const totalEngagements = totalLikes + (feedStats.totalComments || 0) + (feedStats.totalShares || 0);

    let isFollowing = false;
    if (currentUserId && currentUserId.toString() !== userId) {
      const follow = await FollowModel.findOne({
        follower: currentUserId,
        following: userId,
      }).lean();
      isFollowing = !!follow;
    }

    if (summaryView) {
      return res.json({
        ...user,
        professionalInfo: {
          ...(user.professionalInfo || {}),
          socialProfiles: compactSocialProfiles(user.professionalInfo?.socialProfiles),
        },
        postsCount,
        followersCount,
        followingCount,
        totalLikes,
        totalEngagements,
        socialMetrics: {
          totalEngagements,
          feedPosts: postsCount,
          feedComments: feedStats.totalComments || 0,
          feedShares: feedStats.totalShares || 0,
          feedSaves: feedStats.totalSaves || 0,
          forumThreads: 0,
          forumReplies: 0,
          forumLikes: 0,
          newFollowers30Days: 0,
          profileFollowers: followersCount,
          storeFollowers: 0,
          recentPosts30Days: feedStats.recentPosts || 0,
          recentThreads30Days: 0,
          recentReplies30Days: 0,
        },
        marketerProfile: null,
        promoterProfile: null,
        isFollowing,
        isOwnProfile: currentUserId?.toString() === userId,
      });
    }

    const reputationSnapshot = await refreshUserReputation({
      _id: userObjectId,
      role: user.role,
      loginStreak: user.loginStreak,
      gamificationProfile: user.gamificationProfile,
      rating: user.rating,
      ratingCount: user.ratingCount,
      ratingUpdatedAt: user.ratingUpdatedAt,
    });

    const [newFollowersCount, threadStatsResult, commentStatsResult] = await Promise.all([
      FollowModel.countDocuments({ following: userId, createdAt: { $gte: sinceDate } }),
      ThreadModel.aggregate([
        {
          $match: {
            author: userObjectId,
            isDeleted: { $ne: true },
          }
        },
        {
          $group: {
            _id: null,
            threadCount: { $sum: 1 },
            totalThreadLikes: { $sum: '$likeCount' },
            totalThreadComments: { $sum: '$commentCount' },
            totalThreadShares: { $sum: '$shareCount' },
            recentThreads: {
              $sum: {
                $cond: [{ $gte: ['$createdAt', sinceDate] }, 1, 0]
              }
            }
          }
        }
      ]),
      CommentModel.aggregate([
        {
          $match: {
            author: userObjectId,
            isDeleted: { $ne: true },
          }
        },
        {
          $group: {
            _id: null,
            commentCount: { $sum: 1 },
            totalCommentLikes: { $sum: '$likeCount' },
            recentComments: {
              $sum: {
                $cond: [{ $gte: ['$createdAt', sinceDate] }, 1, 0]
              }
            }
          }
        }
      ]),
    ]);

    const threadStats = threadStatsResult[0] || {};
    const commentStats = commentStatsResult[0] || {};
    const detailedTotalEngagements =
      totalEngagements +
      (threadStats.totalThreadLikes || 0) +
      (threadStats.totalThreadComments || 0) +
      (threadStats.totalThreadShares || 0) +
      (commentStats.totalCommentLikes || 0);

    const roleProfile = user.role === 'marketer'
      ? await buildMarketerProfile(userObjectId, user, sinceDate)
      : user.role === 'promoter'
        ? await buildPromoterProfile(userObjectId, sinceDate)
        : null;

    const marketerSocialBoost = roleProfile?.storeSummary?.totalStoreFollowers || 0;

    res.json({
      ...user,
      rating: reputationSnapshot.rating,
      ratingCount: reputationSnapshot.ratingCount,
      professionalInfo: {
        ...(user.professionalInfo || {}),
        socialProfiles: compactSocialProfiles(user.professionalInfo?.socialProfiles),
      },
      postsCount,
      followersCount,
      followingCount,
      totalLikes,
      totalEngagements: detailedTotalEngagements,
      socialMetrics: {
        totalEngagements: detailedTotalEngagements,
        feedPosts: postsCount,
        feedComments: feedStats.totalComments || 0,
        feedShares: feedStats.totalShares || 0,
        feedSaves: feedStats.totalSaves || 0,
        forumThreads: threadStats.threadCount || 0,
        forumReplies: commentStats.commentCount || 0,
        forumLikes: (threadStats.totalThreadLikes || 0) + (commentStats.totalCommentLikes || 0),
        newFollowers30Days: newFollowersCount,
        profileFollowers: followersCount,
        storeFollowers: marketerSocialBoost,
        recentPosts30Days: feedStats.recentPosts || 0,
        recentThreads30Days: threadStats.recentThreads || 0,
        recentReplies30Days: commentStats.recentComments || 0,
      },
      marketerProfile: user.role === 'marketer' ? roleProfile : null,
      promoterProfile: user.role === 'promoter' ? roleProfile : null,
      isFollowing,
      isOwnProfile: currentUserId?.toString() === userId,
    });
  } catch (error) {
    console.error('Error in getProfile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get user's posts (paginated)
export const getUserPosts = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10, currentUserId } = req.query;
    const skip = (page - 1) * limit;

    const currentViewerId = req.userId || currentUserId;
    const currentViewerObjectId = mongoose.Types.ObjectId.isValid(currentViewerId)
      ? new mongoose.Types.ObjectId(currentViewerId)
      : null;

    const posts = await FeedPostModel.aggregate([
      { $match: { author: new mongoose.Types.ObjectId(userId), status: 'published' } },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: parseInt(limit, 10) },
      {
        $lookup: {
          from: 'users',
          localField: 'author',
          foreignField: '_id',
          as: 'authorDetails'
        }
      },
      { $unwind: '$authorDetails' },
      {
        $addFields: {
          likeCount: { $size: '$likes' },
          commentCount: { $size: '$comments' },
          shareCount: { $size: '$shares' },
          saveCount: { $size: '$savedBy' },
          chatCount: {
            $ifNull: ['$socialMetrics.chatClicks', { $ifNull: ['$socialMetrics.externalClicks', 0] }]
          },
          phone: { $ifNull: ['$authorDetails.personalInfo.phone', ''] },
          isLikedByMe: currentViewerObjectId ? { $in: [currentViewerObjectId, '$likes.user'] } : false,
          isSavedByMe: currentViewerObjectId ? { $in: [currentViewerObjectId, '$savedBy.user'] } : false,
          author: {
            _id: '$authorDetails._id',
            displayName: '$authorDetails.displayName',
            username: '$authorDetails.username',
            avatar: '$authorDetails.avatar',
            role: '$authorDetails.role',
            badge: '$authorDetails.badge',
            rating: '$authorDetails.rating',
            isVerified: '$authorDetails.isVerified'
          }
        }
      },
      {
        $project: {
          likes: 0,
          comments: 0,
          shares: 0,
          savedBy: 0,
          authorDetails: 0
        }
      }
    ]);

    const total = await FeedPostModel.countDocuments({ author: userId, status: 'published' });

    res.json({
      posts,
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get followers list (paginated)
export const getFollowers = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const followers = await FollowModel.find({ following: userId })
      .populate('follower', 'displayName username avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .lean();

    const total = await FollowModel.countDocuments({ following: userId });

    res.json({
      followers: followers.map((follow) => follow.follower),
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get following list (paginated)
export const getFollowing = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const following = await FollowModel.find({ follower: userId })
      .populate('following', 'displayName username avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .lean();

    const total = await FollowModel.countDocuments({ follower: userId });

    res.json({
      following: following.map((follow) => follow.following),
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Toggle follow/unfollow
export const toggleFollow = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.userId || req.body.currentUserId;

    if (!currentUserId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (currentUserId.toString() === userId) {
      return res.status(400).json({ message: 'You cannot follow yourself' });
    }

    const existing = await FollowModel.findOne({
      follower: currentUserId,
      following: userId,
    });

    if (existing) {
      await existing.deleteOne();
      res.json({ followed: false });
    } else {
      await FollowModel.create({ follower: currentUserId, following: userId });
      res.json({ followed: true });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
