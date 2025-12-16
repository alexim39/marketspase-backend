import { UserModel } from '../../models/user.model.js';
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
 * Get users by specific role with pagination
 * GET /api/user/admin/users/role/:role
 */
export const getUsersByRole = async (req, res) => {
  try {
    const { role } = req.params;
    const {
      page = 1,
      limit = 50,
      search = '',
      sort = '-createdAt',
      isActive,
      isVerified
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 200);
    const skip = (pageNum - 1) * limitNum;

    // Validate role
    const validRoles = ['marketer', 'promoter', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be one of: marketer, promoter, admin'
      });
    }

    // Build query
    const query = {
      isDeleted: false,
      role
    };

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    if (isVerified !== undefined) {
      query.isVerified = isVerified === 'true';
    }

    // Search filter
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { username: searchRegex },
        { email: searchRegex },
        { displayName: searchRegex }
      ];
    }

    const sortObj = buildUserSort(sort);
    const projection = buildUserProjection();

    // Execute queries
    const [users, total] = await Promise.all([
      UserModel.find(query)
        .select(projection)
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      
      UserModel.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limitNum);

    res.status(200).json({
      success: true,
      message: `${role.charAt(0).toUpperCase() + role.slice(1)} users fetched successfully`,
      data: {
        users,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages,
          hasNext: pageNum < totalPages,
          hasPrev: pageNum > 1
        }
      }
    });

  } catch (error) {
    console.error(`Error fetching ${req.params.role} users:`, error);
    res.status(500).json({
      success: false,
      message: `An error occurred while fetching ${req.params.role} users.`
    });
  }
};