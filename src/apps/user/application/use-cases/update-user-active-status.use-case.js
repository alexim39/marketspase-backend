import { UpdateUserActiveStatusDto } from '../dto/update-user-active-status.dto.js';

export class UpdateUserActiveStatusUseCase {
  constructor({ adminUserStatusGateway } = {}) {
    if (!adminUserStatusGateway) {
      throw new Error('adminUserStatusGateway is required');
    }

    this.adminUserStatusGateway = adminUserStatusGateway;
  }

  async execute(input) {
    const dto = input instanceof UpdateUserActiveStatusDto
      ? input
      : new UpdateUserActiveStatusDto(input);

    if (typeof dto.isActive !== 'boolean') {
      return {
        statusCode: 400,
        body: {
          success: false,
          message: 'isActive must be a boolean value',
        },
      };
    }

    if (!this.adminUserStatusGateway.isValidUserId(dto.userId)) {
      return {
        statusCode: 400,
        body: {
          success: false,
          message: 'Invalid user ID format',
        },
      };
    }

    const user = await this.adminUserStatusGateway.findUserById(dto.userId);

    if (!user) {
      return {
        statusCode: 404,
        body: {
          success: false,
          message: 'User not found',
        },
      };
    }

    if (user.isDeleted) {
      return {
        statusCode: 400,
        body: {
          success: false,
          message: 'Cannot update status of deleted user',
        },
      };
    }

    const updatedUser = await this.adminUserStatusGateway.saveUserActiveStatus({
      user,
      isActive: dto.isActive,
    });

    await this.adminUserStatusGateway.logUserStatusChange({
      user: updatedUser,
      isActive: dto.isActive,
      actorId: dto.actorId,
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        message: `User ${dto.isActive ? 'activated' : 'deactivated'} successfully`,
        data: {
          _id: updatedUser._id,
          isActive: updatedUser.isActive,
          updatedAt: updatedUser.updatedAt,
        },
      },
    };
  }
}
