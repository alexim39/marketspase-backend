import { UserModel } from '../../models/user.model.js';
import mongoose from 'mongoose';

/**
 * Get user by ID
 * GET /api/user/admin/:id
 */
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    const user = await UserModel.findById(id)
      .select('-password -deviceTokens -sseConnections -activityLog')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    //console.log('user found ',user)

    if (user.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'User has been deleted'
      });
    }

    res.status(200).json({
      success: true,
      message: 'User fetched successfully',
      data: user
    });

  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching user.'
    });
  }
};