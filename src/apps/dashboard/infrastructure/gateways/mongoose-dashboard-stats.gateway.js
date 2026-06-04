import { CampaignClickModel } from '../../../campaign/models/campaign-click.model.js';
import { CampaignModel } from '../../../campaign/models/campaign.model.js';
import { FeedPostModel } from '../../../feeds/models/feed/index.js';
import { ThreadModel } from '../../../forum/models/thread/index.js';
import { UserBadgeModel } from '../../../badges/models/user-badge.model.js';
import { PromotionModel } from '../../../promotion/models/promotion.model.js';
import { OrderModel } from '../../../store/models/order/index.js';
import { ProductModel } from '../../../store/models/promotion/index.js';
import { StoreModel } from '../../../store/models/store/index.js';
import { UserModel } from '../../../user/models/user/index.js';
import { DashboardStatsGateway } from '../../application/ports/dashboard-stats.gateway.js';

export class MongooseDashboardStatsGateway extends DashboardStatsGateway {
  async getCampaignStats() {
    return CampaignModel.aggregate([
      {
        $match: {
          isDeleted: false,
          status: { $in: ['active', 'pending', 'completed'] },
        },
      },
      {
        $group: {
          _id: null,
          totalCampaigns: { $sum: 1 },
          activeCampaigns: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] },
          },
          pendingCampaigns: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
          },
          completedCampaigns: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
          },
        },
      },
      {
        $project: {
          _id: 0,
          totalCampaigns: 1,
          activeCampaigns: 1,
          pendingCampaigns: 1,
          completedCampaigns: 1,
        },
      },
    ]);
  }

  async getUserStats() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return UserModel.aggregate([
      {
        $match: {
          isDeleted: false,
        },
      },
      {
        $facet: {
          currentStats: [
            {
              $group: {
                _id: null,
                totalUsers: { $sum: 1 },
                activeUsers: {
                  $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] },
                },
              },
            },
          ],
          previousStats: [
            {
              $match: {
                createdAt: { $lt: thirtyDaysAgo },
              },
            },
            {
              $group: {
                _id: null,
                totalUsers: { $sum: 1 },
              },
            },
          ],
        },
      },
      {
        $project: {
          totalUsers: { $arrayElemAt: ['$currentStats.totalUsers', 0] },
          activeUsers: { $arrayElemAt: ['$currentStats.activeUsers', 0] },
          previousTotalUsers: { $arrayElemAt: ['$previousStats.totalUsers', 0] },
        },
      },
      {
        $project: {
          totalUsers: 1,
          activeUsers: 1,
          usersChange: {
            $cond: [
              { $eq: ['$previousTotalUsers', 0] },
              0,
              {
                $multiply: [
                  {
                    $divide: [
                      { $subtract: ['$totalUsers', '$previousTotalUsers'] },
                      '$previousTotalUsers',
                    ],
                  },
                  100,
                ],
              },
            ],
          },
        },
      },
    ]);
  }

  async getRevenueStats() {
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);

    const previousMonth = new Date(currentMonth);
    previousMonth.setMonth(previousMonth.getMonth() - 1);

    return CampaignModel.aggregate([
      {
        $match: {
          isDeleted: false,
          status: { $in: ['active', 'completed'] },
        },
      },
      {
        $facet: {
          totalRevenue: [
            {
              $group: {
                _id: null,
                totalRevenue: { $sum: '$budget' },
              },
            },
          ],
          currentMonth: [
            {
              $match: {
                createdAt: { $gte: currentMonth },
              },
            },
            {
              $group: {
                _id: null,
                revenue: { $sum: '$budget' },
              },
            },
          ],
          previousMonth: [
            {
              $match: {
                createdAt: {
                  $gte: previousMonth,
                  $lt: currentMonth,
                },
              },
            },
            {
              $group: {
                _id: null,
                revenue: { $sum: '$budget' },
              },
            },
          ],
        },
      },
      {
        $project: {
          totalRevenue: { $arrayElemAt: ['$totalRevenue.totalRevenue', 0] },
          currentMonthRevenue: { $arrayElemAt: ['$currentMonth.revenue', 0] },
          previousMonthRevenue: { $arrayElemAt: ['$previousMonth.revenue', 0] },
        },
      },
      {
        $project: {
          totalRevenue: { $ifNull: ['$totalRevenue', 0] },
          currentMonthRevenue: { $ifNull: ['$currentMonthRevenue', 0] },
          previousMonthRevenue: { $ifNull: ['$previousMonthRevenue', 0] },
          revenueChange: {
            $cond: [
              { $eq: ['$previousMonthRevenue', 0] },
              0,
              {
                $multiply: [
                  {
                    $divide: [
                      { $subtract: ['$currentMonthRevenue', '$previousMonthRevenue'] },
                      '$previousMonthRevenue',
                    ],
                  },
                  100,
                ],
              },
            ],
          },
        },
      },
    ]);
  }

  async getEngagementStats() {
    return [{
      averageEngagement: 75.5,
      engagementChange: 12.3,
      currentWeekEngagement: 78.2,
      previousWeekEngagement: 69.6,
    }];
  }

  async getAdminOverviewStats() {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - (24 * 60 * 60 * 1000));

    const [
      totalUsers,
      marketers,
      promoters,
      activeUsers,
      totalCampaigns,
      activeCampaigns,
      pendingCampaigns,
      totalPromotions,
      submittedPromotions,
      totalCampaignClicks,
      totalStores,
      totalProducts,
      paidOrders,
      grossMerchandiseValueResult,
      totalFeedPosts,
      totalThreads,
      feedPosts24h,
      forumThreads24h,
      activeStreakUsers,
      badgeAwards,
      leveledUsers,
    ] = await Promise.all([
      UserModel.countDocuments({ isDeleted: false }),
      UserModel.countDocuments({ isDeleted: false, role: 'marketer' }),
      UserModel.countDocuments({ isDeleted: false, role: 'promoter' }),
      UserModel.countDocuments({ isDeleted: false, isActive: true }),
      CampaignModel.countDocuments({ isDeleted: false }),
      CampaignModel.countDocuments({ isDeleted: false, status: 'active' }),
      CampaignModel.countDocuments({ isDeleted: false, status: 'pending' }),
      PromotionModel.countDocuments({}),
      PromotionModel.countDocuments({
        $or: [
          { status: 'submitted' },
          { status: 'pending' },
        ],
      }),
      CampaignClickModel.countDocuments({}),
      StoreModel.countDocuments({ isDeleted: { $ne: true } }),
      ProductModel.countDocuments({ isDeleted: { $ne: true }, isPublished: true }),
      OrderModel.countDocuments({ isDeleted: { $ne: true }, paymentStatus: 'paid' }),
      OrderModel.aggregate([
        {
          $match: {
            isDeleted: { $ne: true },
            paymentStatus: 'paid',
          },
        },
        {
          $group: {
            _id: null,
            grossMerchandiseValue: { $sum: '$totalAmount' },
          },
        },
      ]),
      FeedPostModel.countDocuments({ status: 'published' }),
      ThreadModel.countDocuments({ isDeleted: { $ne: true }, isHidden: { $ne: true } }),
      FeedPostModel.countDocuments({ status: 'published', createdAt: { $gte: last24Hours } }),
      ThreadModel.countDocuments({ isDeleted: { $ne: true }, isHidden: { $ne: true }, createdAt: { $gte: last24Hours } }),
      UserModel.countDocuments({ isDeleted: false, 'loginStreak.currentStreak': { $gt: 0 } }),
      UserBadgeModel.countDocuments({}),
      UserModel.countDocuments({ isDeleted: false, 'gamificationProfile.level': { $gt: 1 } }),
    ]);

    return {
      users: {
        totalUsers,
        marketers,
        promoters,
        activeUsers,
      },
      ads: {
        totalCampaigns,
        activeCampaigns,
        pendingCampaigns,
        totalPromotions,
        submittedPromotions,
        totalCampaignClicks,
      },
      commerce: {
        totalStores,
        totalProducts,
        paidOrders,
        grossMerchandiseValue: grossMerchandiseValueResult?.[0]?.grossMerchandiseValue || 0,
      },
      community: {
        totalFeedPosts,
        totalThreads,
        feedPosts24h,
        forumThreads24h,
      },
      rewards: {
        activeStreakUsers,
        badgeAwards,
        leveledUsers,
      },
    };
  }
}
