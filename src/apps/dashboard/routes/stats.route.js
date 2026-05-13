import express from 'express';
import { 
  getCampaignStats, 
  getUserStats, 
  getRevenueStats,
  getEngagementStats,
  getAdminOverviewStats
} from '../controllers/stats.controller.js';
import { catchAsync } from '../services/catch-async.middleware.js'; // Optional error handling middleware
import { getUsersOnlineCount } from './../controllers/online-count.controller.js'
import { getLiveActivityFeed } from '../controllers/live-activity.controller.js';
import { authenticate } from '../../../shared/middleware/auth.middleware.js';
import { requireAdmin } from '../../../shared/middleware/authorization.middleware.js';

const StatsRouter = express.Router();

// Route definitions
StatsRouter.get('/campaigns', async (req, res) => {
  const result = await getCampaignStats(req, res);
  
  if (Array.isArray(result) && result.length > 0) {
    return res.status(200).json({
      success: true,
      data: result[0]
    });
  }
  
  return res.status(200).json({
    success: true,
    data: {
      totalCampaigns: 0,
      activeCampaigns: 0,
      pendingCampaigns: 0,
      completedCampaigns: 0,
      activeCampaignsChange: 0
    }
  });
});

StatsRouter.get('/users', catchAsync(async (req, res) => {
  const result = await getUserStats(req, res);
  
  if (Array.isArray(result) && result.length > 0) {
    return res.status(200).json({
      success: true,
      data: result[0]
    });
  }
  
  return res.status(200).json({
    success: true,
    data: {
      totalUsers: 0,
      activeUsers: 0,
      usersChange: 0
    }
  });
}));

StatsRouter.get('/revenue', catchAsync(async (req, res) => {
  const result = await getRevenueStats(req, res);
  
  if (Array.isArray(result) && result.length > 0) {
    return res.status(200).json({
      success: true,
      data: result[0]
    });
  }
  
  return res.status(200).json({
    success: true,
    data: {
      totalRevenue: 0,
      revenueChange: 0,
      currentMonthRevenue: 0,
      previousMonthRevenue: 0
    }
  });
}));

// Combined dashboard stats endpoint (optional but recommended)
StatsRouter.get('/dashboard', catchAsync(async (req, res) => {
  try {
    const [campaignStats, userStats, revenueStats] = await Promise.all([
      getCampaignStats(req, res),
      getUserStats(req, res),
      getRevenueStats(req, res)
    ]);
    
    return res.status(200).json({
      success: true,
      data: {
        campaigns: Array.isArray(campaignStats) && campaignStats.length > 0 ? campaignStats[0] : {
          totalCampaigns: 0,
          activeCampaigns: 0,
          pendingCampaigns: 0,
          completedCampaigns: 0,
          activeCampaignsChange: 0
        },
        users: Array.isArray(userStats) && userStats.length > 0 ? userStats[0] : {
          totalUsers: 0,
          activeUsers: 0,
          usersChange: 0
        },
        revenue: Array.isArray(revenueStats) && revenueStats.length > 0 ? revenueStats[0] : {
          totalRevenue: 0,
          revenueChange: 0,
          currentMonthRevenue: 0,
          previousMonthRevenue: 0
        },
        // Add engagement stats placeholder (you need to implement this)
        engagement: {
          averageEngagement: 0,
          engagementChange: 0,
          currentWeekEngagement: 0,
          previousWeekEngagement: 0
        }
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching dashboard statistics',
      error: error.message
    });
  }
}));

// Add this route to your StatsRouter
StatsRouter.get('/engagement', catchAsync(async (req, res) => {
  const result = await getEngagementStats(req, res);
  
  if (Array.isArray(result) && result.length > 0) {
    return res.status(200).json({
      success: true,
      data: result[0]
    });
  }
  
  return res.status(200).json({
    success: true,
    data: {
      averageEngagement: 0,
      engagementChange: 0,
      currentWeekEngagement: 0,
      previousWeekEngagement: 0
    }
  });
}));

StatsRouter.get('/admin-overview', authenticate, requireAdmin, catchAsync(async (_req, res) => {
  const data = await getAdminOverviewStats();
  return res.status(200).json({
    success: true,
    data,
  });
}));

StatsRouter.get('/online-count', catchAsync(getUsersOnlineCount))
StatsRouter.get('/live-activity', authenticate, catchAsync(getLiveActivityFeed))

export default StatsRouter;
