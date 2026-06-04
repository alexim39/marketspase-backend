import { UserModel } from '../../models/user/index.js';
import mongoose from 'mongoose';
import { RestoreAdminUserDto } from '../../application/dto/restore-admin-user.dto.js';
import { RestoreAdminUserUseCase } from '../../application/use-cases/restore-admin-user.use-case.js';
import { MongooseAdminUserLifecycleGateway } from '../../infrastructure/gateways/mongoose-admin-user-lifecycle.gateway.js';

const isUserAdminDddEnabled = () => process.env.USER_ADMIN_DDD_ENABLED !== 'false';
const adminUserLifecycleGateway = new MongooseAdminUserLifecycleGateway();
const restoreAdminUserUseCase = new RestoreAdminUserUseCase({ adminUserLifecycleGateway });

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
 * Restore soft-deleted user
 * PATCH /api/user/admin/:id/restore
 */
export const restoreUser = async (req, res) => {
  if (isUserAdminDddEnabled()) {
    try {
      const response = await restoreAdminUserUseCase.execute(
        RestoreAdminUserDto.fromRequest({
          params: req.params || {},
          user: req.user || null,
        })
      );

      return res.status(response.statusCode).json(response.body);
    } catch (error) {
      console.error('Error restoring user:', error);
      return res.status(500).json({
        success: false,
        message: 'An error occurred while restoring user.'
      });
    }
  }

  try {
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    const user = await UserModel.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.isDeleted) {
      return res.status(400).json({
        success: false,
        message: 'User is not deleted'
      });
    }

    // Restore user
    user.isDeleted = false;
    user.deletedAt = undefined;
    user.deletedBy = undefined;
    await user.save();

    // Log the activity
    await user.logActivity(
      'user_restored',
      'User account restored',
      {
        resourceType: 'user',
        resourceId: user._id,
        performedBy: req.user?._id || 'system'
      }
    );

    res.status(200).json({
      success: true,
      message: 'User restored successfully',
      data: {
        _id: user._id,
        isDeleted: user.isDeleted
      }
    });

  } catch (error) {
    console.error('Error restoring user:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while restoring user.'
    });
  }
};
