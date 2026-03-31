import { UserModel } from '../../models/user/index.js';
import mongoose from 'mongoose';

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
 * Get user summary statistics (for dashboard)
 * GET /api/user/admin/users/summary
 */
export const getUserSummary = async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const summary = await UserModel.aggregate([
      {
        $match: { isDeleted: false }
      },
      {
        $facet: {
          // Count by role
          roleCounts: [
            {
              $group: {
                _id: '$role',
                count: { $sum: 1 }
              }
            }
          ],
          // Status counts
          statusCounts: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                active: { $sum: { $cond: ['$isActive', 1, 0] } },
                verified: { $sum: { $cond: ['$isVerified', 1, 0] } }
              }
            }
          ],
          // Recent registrations (last 30 days)
          recentStats: [
            {
              $match: {
                createdAt: { $gte: thirtyDaysAgo }
              }
            },
            {
              $group: {
                _id: null,
                recentRegistrations: { $sum: 1 },
                recentActive: { $sum: { $cond: ['$isActive', 1, 0] } }
              }
            }
          ],
          // Monthly growth (last 6 months)
          monthlyGrowth: [
            {
              $group: {
                _id: {
                  year: { $year: '$createdAt' },
                  month: { $month: '$createdAt' }
                },
                count: { $sum: 1 }
              }
            },
            { $sort: { '_id.year': -1, '_id.month': -1 } },
            { $limit: 6 }
          ]
        }
      },
      {
        $project: {
          roleCounts: {
            $arrayToObject: {
              $map: {
                input: '$roleCounts',
                as: 'role',
                in: { k: '$$role._id', v: '$$role.count' }
              }
            }
          },
          totals: { $arrayElemAt: ['$statusCounts', 0] },
          recent: { $arrayElemAt: ['$recentStats', 0] },
          monthlyGrowth: '$monthlyGrowth'
        }
      }
    ]);

    res.status(200).json({
      success: true,
      message: 'User summary fetched successfully',
      data: summary[0] || {
        roleCounts: {},
        totals: { total: 0, active: 0, verified: 0 },
        recent: { recentRegistrations: 0, recentActive: 0 },
        monthlyGrowth: []
      }
    });

  } catch (error) {
    console.error('Error fetching user summary:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching user summary.'
    });
  }
};