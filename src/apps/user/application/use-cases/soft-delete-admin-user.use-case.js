import { SoftDeleteAdminUserDto } from '../dto/soft-delete-admin-user.dto.js';

export class SoftDeleteAdminUserUseCase {
  constructor({ adminUserLifecycleGateway, now = () => new Date() } = {}) {
    if (!adminUserLifecycleGateway) {
      throw new Error('adminUserLifecycleGateway is required');
    }

    this.adminUserLifecycleGateway = adminUserLifecycleGateway;
    this.now = now;
  }

  async execute(input) {
    const dto = input instanceof SoftDeleteAdminUserDto
      ? input
      : new SoftDeleteAdminUserDto(input);

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

    if (user.isDeleted) {
      return {
        statusCode: 400,
        body: {
          success: false,
          message: 'User is already deleted',
        },
      };
    }

    const deletedAt = this.now();
    const deletedUser = await this.adminUserLifecycleGateway.softDeleteUser({
      user,
      actorId: dto.actorId,
      deletedAt,
    });

    await this.adminUserLifecycleGateway.logUserDeleted({
      user: deletedUser,
      actorId: dto.actorId,
      deletedAt: deletedUser.deletedAt,
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        message: 'User deleted successfully',
        data: {
          _id: deletedUser._id,
          isDeleted: deletedUser.isDeleted,
          deletedAt: deletedUser.deletedAt,
        },
      },
    };
  }
}
