import { UserModel } from '../../models/user/index.js';
import { GetAdminUsersDto } from '../../application/dto/get-admin-users.dto.js';
import { GetAdminUsersUseCase } from '../../application/use-cases/get-admin-users.use-case.js';
import { MongooseAdminUserListGateway } from '../../infrastructure/gateways/mongoose-admin-user-list.gateway.js';

const isUserAdminDddEnabled = () => process.env.USER_ADMIN_DDD_ENABLED !== 'false';
const adminUserListGateway = new MongooseAdminUserListGateway();
const getAdminUsersUseCase = new GetAdminUsersUseCase({ adminUserListGateway });

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
 * Get all users with pagination and filters
 * GET /api/user/admin/users
 */
export const getUsers = async (req, res) => {
  if (isUserAdminDddEnabled()) {
    try {
      const response = await getAdminUsersUseCase.execute(
        GetAdminUsersDto.fromRequest({
          query: req.query || {},
        })
      );

      return res.status(response.statusCode).json(response.body);
    } catch (error) {
      console.error('Error fetching users:', error);
      return res.status(500).json({
        success: false,
        message: 'An error occurred while fetching users.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  try {
    // Extract query parameters
    const {
      page = 1,
      limit = 50,
      search = '',
      sort = '-createdAt',
      role,
      isActive,
      isVerified
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 200); // Cap at 200 for safety
    const skip = (pageNum - 1) * limitNum;

    // Build query, sort, and projection
    const query = buildUserQuery({ search, role, isActive, isVerified });
    const sortObj = buildUserSort(sort);
    const projection = buildUserProjection();

    // Execute queries in parallel for better performance
    const [users, total] = await Promise.all([
      UserModel.find(query)
        .select(projection)
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum)
        .lean(), // Use lean() for faster read-only operations
      
      UserModel.countDocuments(query)
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limitNum);
    const hasNext = pageNum < totalPages;
    const hasPrev = pageNum > 1;

    res.status(200).json({
      success: true,
      message: 'Users fetched successfully',
      data: {
        users,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages,
          hasNext,
          hasPrev
        }
      }
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching users.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
