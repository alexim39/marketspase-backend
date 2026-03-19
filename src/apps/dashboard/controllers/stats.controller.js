import { UserModel } from '../../user/models/user/index.js';
import { CampaignModel } from '../../campaign/models/campaign.model.js';

export const getCampaignStats = async (req, res) => {
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

export const getUserStats = async (req, res) => {
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

export const getRevenueStats = async (req, res) => {
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


export const getEngagementStats = async (req, res) => {
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