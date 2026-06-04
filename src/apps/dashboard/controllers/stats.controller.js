import { UserModel } from '../../user/models/user/index.js';
import { CampaignModel } from '../../campaign/models/campaign.model.js';
import { CampaignClickModel } from '../../campaign/models/campaign-click.model.js';
import { PromotionModel } from '../../promotion/models/promotion.model.js';
import { StoreModel } from '../../store/models/store/index.js';
import { ProductModel } from '../../store/models/promotion/index.js';
import { OrderModel } from '../../store/models/order/index.js';
import { FeedPostModel } from '../../feeds/models/feed/index.js';
import { ThreadModel } from '../../forum/models/thread/index.js';
import { UserBadgeModel } from '../../badges/models/user-badge.model.js';
import { GetAdminOverviewStatsUseCase } from '../application/use-cases/get-admin-overview-stats.use-case.js';
import { GetCampaignStatsUseCase } from '../application/use-cases/get-campaign-stats.use-case.js';
import { GetEngagementStatsUseCase } from '../application/use-cases/get-engagement-stats.use-case.js';
import { GetRevenueStatsUseCase } from '../application/use-cases/get-revenue-stats.use-case.js';
import { GetUserStatsUseCase } from '../application/use-cases/get-user-stats.use-case.js';
import { MongooseDashboardStatsGateway } from '../infrastructure/gateways/mongoose-dashboard-stats.gateway.js';

const dashboardStatsGateway = new MongooseDashboardStatsGateway();
const getCampaignStatsUseCase = new GetCampaignStatsUseCase({ dashboardStatsGateway });
const getUserStatsUseCase = new GetUserStatsUseCase({ dashboardStatsGateway });
const getRevenueStatsUseCase = new GetRevenueStatsUseCase({ dashboardStatsGateway });
const getEngagementStatsUseCase = new GetEngagementStatsUseCase({ dashboardStatsGateway });
const getAdminOverviewStatsUseCase = new GetAdminOverviewStatsUseCase({ dashboardStatsGateway });

const isDashboardDddEnabled = () => process.env.DASHBOARD_DDD_ENABLED !== 'false';

const legacyGetCampaignStats = async (req, res) => {
  try {
    const result = await CampaignModel.aggregate([
      {
        $match: {
          isDeleted: false,
          status: { $in: ['active', 'pending', 'completed'] }
        }
      },
      {
        $group: {
          _id: null,
          totalCampaigns: { $sum: 1 },
          activeCampaigns: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          pendingCampaigns: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          completedCampaigns: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalCampaigns: 1,
          activeCampaigns: 1,
          pendingCampaigns: 1,
          completedCampaigns: 1
        }
      }
    ]);
    
    return result; // Return the result
  } catch (error) {
    console.error('Error fetching campaign stats:', error);
    throw error; // Throw error to be caught by route handler
  }
}

const legacyGetUserStats = async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await UserModel.aggregate([
      {
        $match: {
          isDeleted: false
        }
      },
      {
        $facet: {
          currentStats: [
            {
              $group: {
                _id: null,
                totalUsers: { $sum: 1 },
                activeUsers: {
                  $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
                }
              }
            }
          ],
          previousStats: [
            {
              $match: {
                createdAt: { $lt: thirtyDaysAgo }
              }
            },
            {
              $group: {
                _id: null,
                totalUsers: { $sum: 1 }
              }
            }
          ]
        }
      },
      {
        $project: {
          totalUsers: { $arrayElemAt: ['$currentStats.totalUsers', 0] },
          activeUsers: { $arrayElemAt: ['$currentStats.activeUsers', 0] },
          previousTotalUsers: { $arrayElemAt: ['$previousStats.totalUsers', 0] }
        }
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
                      '$previousTotalUsers'
                    ]
                  },
                  100
                ]
              }
            ]
          }
        }
      }
    ]);
    
    return result; // Return the result
  } catch (error) {
    console.error('Error fetching user stats:', error);
    throw error;
  }
}

const legacyGetRevenueStats = async (req, res) => {
  try {
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);
    
    const previousMonth = new Date(currentMonth);
    previousMonth.setMonth(previousMonth.getMonth() - 1);

    const result = await CampaignModel.aggregate([
      {
        $match: {
          isDeleted: false,
          status: { $in: ['active', 'completed'] }
        }
      },
      {
        $facet: {
          totalRevenue: [
            {
              $group: {
                _id: null,
                totalRevenue: { $sum: '$budget' }
              }
            }
          ],
          currentMonth: [
            {
              $match: {
                createdAt: { $gte: currentMonth }
              }
            },
            {
              $group: {
                _id: null,
                revenue: { $sum: '$budget' }
              }
            }
          ],
          previousMonth: [
            {
              $match: {
                createdAt: { 
                  $gte: previousMonth,
                  $lt: currentMonth
                }
              }
            },
            {
              $group: {
                _id: null,
                revenue: { $sum: '$budget' }
              }
            }
          ]
        }
      },
      {
        $project: {
          totalRevenue: { $arrayElemAt: ['$totalRevenue.totalRevenue', 0] },
          currentMonthRevenue: { $arrayElemAt: ['$currentMonth.revenue', 0] },
          previousMonthRevenue: { $arrayElemAt: ['$previousMonth.revenue', 0] }
        }
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
                      '$previousMonthRevenue'
                    ]
                  },
                  100
                ]
              }
            ]
          }
        }
      }
    ]);
    
    return result; // Return the result
  } catch (error) {
    console.error('Error fetching revenue stats:', error);
    throw error;
  }
}


const legacyGetEngagementStats = async (req, res) => {
  try {
    // Since you don't have an engagement model yet, let's create a basic implementation
    // You'll need to implement this properly based on your business logic
    
    // For now, return placeholder data
    return [{
      averageEngagement: 75.5,
      engagementChange: 12.3,
      currentWeekEngagement: 78.2,
      previousWeekEngagement: 69.6
    }];
    
    /* 
    // Example of what your actual implementation might look like:
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    
    const result = await EngagementModel.aggregate([
      // Your aggregation logic here
    ]);
    
    return result;
    */
  } catch (error) {
    console.error('Error fetching engagement stats:', error);
    throw error;
  }
}

const legacyGetAdminOverviewStats = async () => {
  try {
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
  } catch (error) {
    console.error('Error fetching admin overview stats:', error);
    throw error;
  }
};

export const getCampaignStats = async (req, res) => {
  if (!isDashboardDddEnabled()) {
    return legacyGetCampaignStats(req, res);
  }

  try {
    return await getCampaignStatsUseCase.execute();
  } catch (error) {
    console.error('Error fetching campaign stats:', error);
    throw error;
  }
};

export const getUserStats = async (req, res) => {
  if (!isDashboardDddEnabled()) {
    return legacyGetUserStats(req, res);
  }

  try {
    return await getUserStatsUseCase.execute();
  } catch (error) {
    console.error('Error fetching user stats:', error);
    throw error;
  }
};

export const getRevenueStats = async (req, res) => {
  if (!isDashboardDddEnabled()) {
    return legacyGetRevenueStats(req, res);
  }

  try {
    return await getRevenueStatsUseCase.execute();
  } catch (error) {
    console.error('Error fetching revenue stats:', error);
    throw error;
  }
};

export const getEngagementStats = async (req, res) => {
  if (!isDashboardDddEnabled()) {
    return legacyGetEngagementStats(req, res);
  }

  try {
    return await getEngagementStatsUseCase.execute();
  } catch (error) {
    console.error('Error fetching engagement stats:', error);
    throw error;
  }
};

export const getAdminOverviewStats = async () => {
  if (!isDashboardDddEnabled()) {
    return legacyGetAdminOverviewStats();
  }

  try {
    return await getAdminOverviewStatsUseCase.execute();
  } catch (error) {
    console.error('Error fetching admin overview stats:', error);
    throw error;
  }
};
