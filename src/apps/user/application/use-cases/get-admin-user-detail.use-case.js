import { GetAdminUserDetailDto } from '../dto/get-admin-user-detail.dto.js';

export class GetAdminUserDetailUseCase {
  constructor({ adminUserDetailGateway } = {}) {
    if (!adminUserDetailGateway) {
      throw new Error('adminUserDetailGateway is required');
    }

    this.adminUserDetailGateway = adminUserDetailGateway;
  }

  async execute(input) {
    const dto = input instanceof GetAdminUserDetailDto
      ? input
      : new GetAdminUserDetailDto(input);

    if (!this.adminUserDetailGateway.isValidUserId(dto.userId)) {
      return {
        statusCode: 400,
        body: {
          success: false,
          message: 'Invalid user ID format',
        },
      };
    }

    const user = await this.adminUserDetailGateway.findUserDetailById(dto.userId);

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
        statusCode: 404,
        body: {
          success: false,
          message: 'User has been deleted',
        },
      };
    }

    return {
      statusCode: 200,
      body: {
        success: true,
        message: 'User fetched successfully',
        data: user,
      },
    };
  }
}
