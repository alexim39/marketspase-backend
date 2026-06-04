import { UserModel } from '../../models/user/index.js';
import mongoose from 'mongoose';
import { GetAdminUserDetailDto } from '../../application/dto/get-admin-user-detail.dto.js';
import { GetAdminUserDetailUseCase } from '../../application/use-cases/get-admin-user-detail.use-case.js';
import { MongooseAdminUserDetailGateway } from '../../infrastructure/gateways/mongoose-admin-user-detail.gateway.js';

const isUserAdminDddEnabled = () => process.env.USER_ADMIN_DDD_ENABLED !== 'false';
const adminUserDetailGateway = new MongooseAdminUserDetailGateway();
const getAdminUserDetailUseCase = new GetAdminUserDetailUseCase({ adminUserDetailGateway });

/**
 * Get user by ID
 * GET /api/user/admin/:id
 */
export const getUserById = async (req, res) => {
  if (isUserAdminDddEnabled()) {
    try {
      const response = await getAdminUserDetailUseCase.execute(
        GetAdminUserDetailDto.fromRequest({
          params: req.params || {},
        })
      );

      return res.status(response.statusCode).json(response.body);
    } catch (error) {
      console.error('Error fetching user:', error);
      return res.status(500).json({
        success: false,
        message: 'An error occurred while fetching user.'
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
