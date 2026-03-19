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
 * Soft delete user
 * DELETE /api/user/admin/:id
 */
export const deleteUser = async (req, res) => {
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

    if (user.isDeleted) {
      return res.status(400).json({
        success: false,
        message: 'User is already deleted'
      });
    }

    // Soft delete
    user.isDeleted = true;
    user.deletedAt = new Date();
    user.deletedBy = req.user?._id || 'system';
    await user.save();

    // Log the activity
    await user.logActivity(
      'user_deleted',
      'User account soft deleted',
      {
        resourceType: 'user',
        resourceId: user._id,
        performedBy: req.user?._id || 'system',
        metadata: { deletedAt: user.deletedAt }
      }
    );

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
      data: {
        _id: user._id,
        isDeleted: user.isDeleted,
        deletedAt: user.deletedAt
      }
    });

  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while deleting user.'
    });
  }
};