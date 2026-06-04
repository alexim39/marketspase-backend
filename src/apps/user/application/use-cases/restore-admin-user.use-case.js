import { RestoreAdminUserDto } from '../dto/restore-admin-user.dto.js';

export class RestoreAdminUserUseCase {
  constructor({ adminUserLifecycleGateway } = {}) {
    if (!adminUserLifecycleGateway) {
      throw new Error('adminUserLifecycleGateway is required');
    }

    this.adminUserLifecycleGateway = adminUserLifecycleGateway;
  }

  async execute(input) {
    const dto = input instanceof RestoreAdminUserDto
      ? input
      : new RestoreAdminUserDto(input);

    if (!this.adminUserLifecycleGateway.isValidUserId(dto.userId)) {
      return {
        statusCode: 400,
        body: {
          success: false,
          message: 'Invalid user ID format',
        },
      };
    }

    const user = await this.adminUserLifecycleGateway.findUserById(dto.userId);

    if (!user) {
      return {
        statusCode: 404,
        body: {
          success: false,
          message: 'User not found',
        },
      };
    }

    if (!user.isDeleted) {
      return {
        statusCode: 400,
        body: {
          success: false,
          message: 'User is not deleted',
        },
      };
    }

    const restoredUser = await this.adminUserLifecycleGateway.restoreUser({ user });

    await this.adminUserLifecycleGateway.logUserRestored({
      user: restoredUser,
      actorId: dto.actorId,
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        message: 'User restored successfully',
        data: {
          _id: restoredUser._id,
          isDeleted: restoredUser.isDeleted,
        },
      },
    };
  }
}
