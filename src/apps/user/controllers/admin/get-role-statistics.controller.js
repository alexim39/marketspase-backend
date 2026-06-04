import { UserModel } from '../../models/user/index.js';
import mongoose from 'mongoose';
import { GetAdminRoleStatisticsDto } from '../../application/dto/get-admin-role-statistics.dto.js';
import { GetAdminRoleStatisticsUseCase } from '../../application/use-cases/get-admin-role-statistics.use-case.js';
import { MongooseAdminRoleStatisticsGateway } from '../../infrastructure/gateways/mongoose-admin-role-statistics.gateway.js';

const isUserAdminDddEnabled = () => process.env.USER_ADMIN_DDD_ENABLED !== 'false';
const adminRoleStatisticsGateway = new MongooseAdminRoleStatisticsGateway();
const getAdminRoleStatisticsUseCase = new GetAdminRoleStatisticsUseCase({ adminRoleStatisticsGateway });

// Helper function to build query from filters
const buildUserQuery = (filters = {}) => {
  const query = { isDeleted: false };
  
  // Role filter
  if (filters.role) {
    query.role = filters.role;
  }
  
  // Status filters
  if (filters.isActive !== undefined) {
    query.isActive = filters.isActive === 'true' ? true : filters.isActive === 'false' ? false : filters.isActive;
  }
  
  if (filters.isVerified !== undefined) {
    query.isVerified = filters.isVerified === 'true' ? true : filters.isVerified === 'false' ? false : filters.isVerified;
  }
  
  // Search filter (text search across multiple fields)
  if (filters.search && filters.search.trim()) {
    const searchRegex = new RegExp(filters.search.trim(), 'i');
    query.$or = [
      { username: searchRegex },
      { email: searchRegex },
      { displayName: searchRegex },
      { 'personalInfo.phone': searchRegex }
    ];
  }
  
  return query;
};

// Helper function to build sorting
const buildUserSort = (sort = '-createdAt') => {
  const sortObj = {};
  
  if (sort.startsWith('-')) {
    sortObj[sort.substring(1)] = -1; // Descending
  } else {
    sortObj[sort] = 1; // Ascending
  }
  
  return sortObj;
};

// Helper function to build projection (fields to return)
const buildUserProjection = () => ({
  password: 0,
  notificationSettings: 0,
  deviceTokens: 0,
  sseConnections: 0,
  activityLog: 0,
  'wallets.marketer.transactions': 0,
  'wallets.promoter.transactions': 0
})


/**
 * Get detailed statistics for a specific role
 * GET /api/user/admin/users/role/:role/stats
 */
export const getRoleStatistics = async (req, res) => {
  if (isUserAdminDddEnabled()) {
    try {
      const response = await getAdminRoleStatisticsUseCase.execute(
        GetAdminRoleStatisticsDto.fromRequest({
          params: req.params || {},
        })
      );

      return res.status(response.statusCode).json(response.body);
    } catch (error) {
      console.error(`Error fetching ${req.params.role} statistics:`, error);
      return res.status(500).json({
        success: false,
        message: `An error occurred while fetching ${req.params.role} statistics.`
      });
    }
  }

  try {
    const { role } = req.params;
    
    // Validate role
    const validRoles = ['marketer', 'promoter', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be one of: marketer, promoter, admin'
      });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const roleStats = await UserModel.aggregate([
      {
        $match: {
          role,
          isDeleted: false
        }
      },
      {
        $facet: {
          // Basic counts
          counts: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                active: { $sum: { $cond: ['$isActive', 1, 0] } },
                verified: { $sum: { $cond: ['$isVerified', 1, 0] } },
                recent: {
                  $sum: {
                    $cond: [
                      { $gte: ['$createdAt', thirtyDaysAgo] },
                      1,
                      0
                    ]
                  }
                }
              }
            }
          ],
          // Financial stats
          financial: [
            {
              $group: {
                _id: null,
                totalBalance: {
                  $sum: {
                    $cond: [
                      { $eq: [role, 'marketer'] },
                      '$wallets.marketer.balance',
                      '$wallets.promoter.balance'
                    ]
                  }
                },
                count: { $sum: 1 }
              }
            },
            {
              $project: {
                totalBalance: { $ifNull: ['$totalBalance', 0] },
                averageBalance: {
                  $cond: [
                    { $eq: ['$count', 0] },
                    0,
                    { $divide: ['$totalBalance', '$count'] }
                  ]
                },
                currency: 'NGN'
              }
            }
          ],
          // Engagement stats (if available)
          engagement: [
            {
              $group: {
                _id: null,
                averageRating: { $avg: '$rating' },
                totalRatings: { $sum: '$ratingCount' },
                ratedUsers: {
                  $sum: {
                    $cond: [
                      { $gt: ['$ratingCount', 0] },
                      1,
                      0
                    ]
                  }
                },
                totalUsers: { $sum: 1 }
              }
            },
            {
              $project: {
                averageRating: { $ifNull: ['$averageRating', 0] },
                totalRatings: { $ifNull: ['$totalRatings', 0] },
                percentageRated: {
                  $cond: [
                    { $eq: ['$totalUsers', 0] },
                    0,
                    { $multiply: [{ $divide: ['$ratedUsers', '$totalUsers'] }, 100] }
                  ]
                }
              }
            }
          ],
          // Activity stats
          activity: [
            {
              $group: {
                _id: null,
                totalReferrals: { $sum: '$referralInfo.totalReferrals' },
                totalEarned: { $sum: '$referralInfo.totalEarned' }
              }
            },
            {
              $project: {
                totalReferrals: { $ifNull: ['$totalReferrals', 0] },
                totalEarned: { $ifNull: ['$totalEarned', 0] }
              }
            }
          ]
        }
      },
      {
        $project: {
          role,
          counts: { $arrayElemAt: ['$counts', 0] },
          financial: { $arrayElemAt: ['$financial', 0] },
          engagement: { $arrayElemAt: ['$engagement', 0] },
          activity: { $arrayElemAt: ['$activity', 0] }
        }
      }
    ]);

    // Transform the response
    const stats = roleStats[0] || {
      role,
      counts: {
        total: 0,
        active: 0,
        verified: 0,
        recent: 0
      },
      financial: {
        totalBalance: 0,
        averageBalance: 0,
        currency: 'NGN'
      },
      engagement: {
        averageRating: 0,
        totalRatings: 0,
        percentageRated: 0
      },
      activity: {
        totalReferrals: 0,
        totalEarned: 0
      }
    };

    // Calculate inactive and unverified counts
    if (stats.counts) {
      stats.counts.inactive = stats.counts.total - stats.counts.active;
      stats.counts.unverified = stats.counts.total - stats.counts.verified;
      stats.counts.deleted = 0; // We filter out deleted users
    }

    res.status(200).json({
      success: true,
      message: `${role} statistics fetched successfully`,
      data: stats
    });

  } catch (error) {
    console.error(`Error fetching ${req.params.role} statistics:`, error);
    res.status(500).json({
      success: false,
      message: `An error occurred while fetching ${req.params.role} statistics.`
    });
  }
};
