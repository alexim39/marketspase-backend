import mongoose from 'mongoose';
import { CampaignModel } from '../../../campaign/models/campaign.model.js';
import { FeedPostModel } from '../../../feeds/models/feed/index.js';
import { CommentModel } from '../../../forum/models/comment/comment.model.js';
import { ThreadModel } from '../../../forum/models/thread/thread.model.js';
import { PromotionModel } from '../../../promotion/models/promotion.model.js';
import { normalizePromotionTrackingFields } from '../../../promotion/utils/promotion-url.js';
import { OrderModel } from '../../../store/models/order/order.model.js';
import { ProductModel } from '../../../store/models/promotion/product/product.model.js';
import { PromotionTrackingModel } from '../../../store/models/promotion/promotion/promotionTracking.model.js';
import { StoreModel } from '../../../store/models/store/store.model.js';
import { UserModel } from '../../../user/models/user/index.js';
import { refreshUserReputation } from '../../../user/services/user-reputation.service.js';
import { FollowModel } from '../../models/follow/index.js';
import { ProfileSocialGateway } from '../../application/ports/profile-social.gateway.js';
import {
  PROFILE_TOP_LIMIT,
  compactSocialProfiles,
  sanitizeProfileString,
  sumStoreValues,
} from '../../application/mappers/profile-detail.mapper.js';

export class MongooseProfileSocialGateway extends ProfileSocialGateway {
  isValidObjectId(value) {
    return mongoose.Types.ObjectId.isValid(value);
  }

  async findProfileUser({ userId, summaryView = false } = {}) {
    return UserModel.findById(userId)
      .select(summaryView
        ? 'uid username displayName avatar personalInfo professionalInfo createdAt updatedAt lastSeenAt role rating ratingCount ratingUpdatedAt collaborationRating collaborationRatingCount collaborationReviewCount isVerified badgeProfile gamificationProfile'
        : 'uid username displayName avatar personalInfo professionalInfo createdAt updatedAt lastSeenAt role rating ratingCount ratingUpdatedAt collaborationRating collaborationRatingCount collaborationReviewCount isVerified badgeProfile gamificationProfile loginStreak')
      .lean();
  }

  async getBaseProfileStats({ userId, sinceDate } = {}) {
    const userObjectId = new mongoose.Types.ObjectId(userId);
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
          },
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
                $cond: [{ $gte: ['$createdAt', sinceDate] }, 1, 0],
              },
            },
          },
        },
      ]),
      FollowModel.countDocuments({ following: userId }),
      FollowModel.countDocuments({ follower: userId }),
    ]);

    return {
      userObjectId,
      feedStats: feedStatsResult[0] || {},
      followersCount,
      followingCount,
    };
  }

  async isFollowingUser({ follower, following } = {}) {
    const follow = await FollowModel.findOne({
      follower,
      following,
    }).lean();

    return Boolean(follow);
  }

  async refreshUserReputation({ userObjectId, user } = {}) {
    return refreshUserReputation({
      _id: userObjectId,
      role: user.role,
      loginStreak: user.loginStreak,
      gamificationProfile: user.gamificationProfile,
      rating: user.rating,
      ratingCount: user.ratingCount,
      ratingUpdatedAt: user.ratingUpdatedAt,
    });
  }

  async getDetailedProfileSocialStats({ userObjectId, userId, sinceDate } = {}) {
    const [newFollowersCount, threadStatsResult, commentStatsResult] = await Promise.all([
      FollowModel.countDocuments({ following: userId, createdAt: { $gte: sinceDate } }),
      ThreadModel.aggregate([
        {
          $match: {
            author: userObjectId,
            isDeleted: { $ne: true },
          },
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
                $cond: [{ $gte: ['$createdAt', sinceDate] }, 1, 0],
              },
            },
          },
        },
      ]),
      CommentModel.aggregate([
        {
          $match: {
            author: userObjectId,
            isDeleted: { $ne: true },
          },
        },
        {
          $group: {
            _id: null,
            commentCount: { $sum: 1 },
            totalCommentLikes: { $sum: '$likeCount' },
            recentComments: {
              $sum: {
                $cond: [{ $gte: ['$createdAt', sinceDate] }, 1, 0],
              },
            },
          },
        },
      ]),
    ]);

    return {
      newFollowersCount,
      threadStats: threadStatsResult[0] || {},
      commentStats: commentStatsResult[0] || {},
    };
  }

  async buildMarketerProfile({ userObjectId, user, sinceDate } = {}) {
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
          },
        },
        {
          $group: {
            _id: null,
            totalCampaigns: { $sum: 1 },
            totalCampaignClicks: { $sum: '$totalClicks' },
            totalBillableClicks: { $sum: '$billableClicks' },
            totalCampaignSpend: { $sum: '$spentBudget' },
          },
        },
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
              },
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
                      0,
                    ],
                  },
                },
              },
            },
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
              },
            },
            {
              $group: {
                _id: null,
                recentOrders: { $sum: 1 },
                recentSalesAmount: { $sum: '$totalAmount' },
              },
            },
          ])
        : Promise.resolve([]),
    ]);

    const campaignLifetimeSummary = campaignLifetime[0] || {};
    const salesLifetimeSummary = salesLifetime[0] || {};
    const recentSalesSummary = recentSales[0] || {};

    const totalViews = sumStoreValues(stores, (store) => store.analytics?.totalViews);
    const totalStoreSales = sumStoreValues(stores, (store) => store.analytics?.totalSales);
    const totalStoreFollowers = stores.reduce((total, store) => (
      total + (Array.isArray(store.followers) ? store.followers.length : 0)
    ), 0);
    const totalPromoterTraffic = sumStoreValues(stores, (store) => store.analytics?.promoterTraffic);
    const totalActiveCampaigns = stores.reduce((total, store) => (
      total + (Array.isArray(store.activeCampaigns) ? store.activeCampaigns.length : 0)
    ), 0);
    const aggregateConversionRate = totalViews > 0
      ? Number(((totalStoreSales / totalViews) * 100).toFixed(2))
      : 0;

    return {
      businessOverview: {
        brandName: sanitizeProfileString(user?.professionalInfo?.businessProfile?.brandName)
          || sanitizeProfileString(stores[0]?.name)
          || sanitizeProfileString(user?.displayName),
        brandSummary: sanitizeProfileString(user?.professionalInfo?.businessProfile?.brandSummary)
          || sanitizeProfileString(user?.personalInfo?.biography)
          || sanitizeProfileString(stores[0]?.description),
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
        periodDays: 30,
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
  }

  async buildPromoterProfile({ userObjectId, sinceDate } = {}) {
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
          },
        },
      ]),
      PromotionModel.countDocuments({
        promoter: userObjectId,
        acceptedAt: { $gte: sinceDate },
      }),
      PromotionTrackingModel.aggregate([
        {
          $match: {
            promoter: userObjectId,
          },
        },
        {
          $group: {
            _id: null,
            totalAffiliateClicks: { $sum: '$clickCount' },
            totalAffiliateSales: { $sum: '$conversionCount' },
            totalAffiliateEarnings: { $sum: '$earnings' },
          },
        },
      ]),
      PromotionTrackingModel.aggregate([
        {
          $match: {
            promoter: userObjectId,
            createdAt: { $gte: sinceDate },
          },
        },
        {
          $group: {
            _id: null,
            recentAffiliateClicks: { $sum: '$clickCount' },
            recentAffiliateSales: { $sum: '$conversionCount' },
            recentAffiliateEarnings: { $sum: '$earnings' },
          },
        },
      ]),
      OrderModel.aggregate([
        {
          $match: {
            paymentStatus: 'paid',
            isDeleted: { $ne: true },
            'items.promoterId': userObjectId,
          },
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
                $cond: [{ $eq: ['$commissionPaid', false] }, '$items.commissionEarned', 0],
              },
            },
            releasedCommission: {
              $sum: {
                $cond: [{ $eq: ['$commissionPaid', true] }, '$items.commissionEarned', 0],
              },
            },
          },
        },
      ]),
      OrderModel.aggregate([
        {
          $match: {
            paymentStatus: 'paid',
            isDeleted: { $ne: true },
            'items.promoterId': userObjectId,
            placedAt: { $gte: sinceDate },
          },
        },
        { $unwind: '$items' },
        { $match: { 'items.promoterId': userObjectId } },
        {
          $group: {
            _id: null,
            recentAttributedSales: { $sum: 1 },
            recentCommissionEarned: { $sum: '$items.commissionEarned' },
          },
        },
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
        periodDays: 30,
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
  }

  async listUserPosts({
    userId,
    limitNumber = 10,
    skip = 0,
    currentViewerId = null,
  } = {}) {
    const currentViewerObjectId = mongoose.Types.ObjectId.isValid(currentViewerId)
      ? new mongoose.Types.ObjectId(currentViewerId)
      : null;

    const posts = await FeedPostModel.aggregate([
      { $match: { author: new mongoose.Types.ObjectId(userId), status: 'published' } },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limitNumber },
      {
        $lookup: {
          from: 'users',
          localField: 'author',
          foreignField: '_id',
          as: 'authorDetails',
        },
      },
      { $unwind: '$authorDetails' },
      {
        $addFields: {
          likeCount: { $size: '$likes' },
          commentCount: { $size: '$comments' },
          shareCount: { $size: '$shares' },
          saveCount: { $size: '$savedBy' },
          chatCount: {
            $ifNull: ['$socialMetrics.chatClicks', { $ifNull: ['$socialMetrics.externalClicks', 0] }],
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
            isVerified: '$authorDetails.isVerified',
          },
        },
      },
      {
        $project: {
          likes: 0,
          comments: 0,
          shares: 0,
          savedBy: 0,
          authorDetails: 0,
        },
      },
    ]);

    const total = await FeedPostModel.countDocuments({ author: userId, status: 'published' });

    return {
      posts,
      total,
    };
  }

  async listFollowers({ userId, skip = 0, limitNumber = 20 } = {}) {
    const [followers, total] = await Promise.all([
      FollowModel.find({ following: userId })
        .populate('follower', 'displayName username avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber)
        .lean(),
      FollowModel.countDocuments({ following: userId }),
    ]);

    return {
      followers: followers.map((follow) => follow.follower),
      total,
    };
  }

  async listFollowing({ userId, skip = 0, limitNumber = 20 } = {}) {
    const [following, total] = await Promise.all([
      FollowModel.find({ follower: userId })
        .populate('following', 'displayName username avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber)
        .lean(),
      FollowModel.countDocuments({ follower: userId }),
    ]);

    return {
      following: following.map((follow) => follow.following),
      total,
    };
  }

  async listSuggestedUsers({ userId, limit = 5 } = {}) {
    const following = await FollowModel.find({ follower: userId }).distinct('following');

    return UserModel.find({
      _id: { $ne: userId, $nin: following },
      isActive: true,
    })
      .limit(limit)
      .select('displayName username avatar')
      .lean();
  }

  async findFollow({ follower, following } = {}) {
    return FollowModel.findOne({
      follower,
      following,
    });
  }

  async deleteFollow(follow) {
    return follow.deleteOne();
  }

  async createFollow({ follower, following } = {}) {
    return FollowModel.create({
      follower,
      following,
    });
  }
}
