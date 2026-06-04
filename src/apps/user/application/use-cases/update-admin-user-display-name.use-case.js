import { validateDisplayName } from '../../domain/services/display-name-normalizer.js';
import { UpdateAdminUserDisplayNameDto } from '../dto/update-admin-user-display-name.dto.js';

export class UpdateAdminUserDisplayNameUseCase {
  constructor({ adminUserDisplayNameGateway } = {}) {
    if (!adminUserDisplayNameGateway) {
      throw new Error('adminUserDisplayNameGateway is required');
    }

    this.adminUserDisplayNameGateway = adminUserDisplayNameGateway;
  }

  async execute(input) {
    const dto = input instanceof UpdateAdminUserDisplayNameDto
      ? input
      : new UpdateAdminUserDisplayNameDto(input);

    const validation = validateDisplayName(dto.displayName);
    if (validation.error) {
      return validation.error;
    }

    if (!this.adminUserDisplayNameGateway.isValidUserId(dto.userId)) {
      return {
        statusCode: 400,
        body: {
          success: false,
          message: 'Invalid user ID format',
        },
      };
    }

    const user = await this.adminUserDisplayNameGateway.updateDisplayName({
      userId: dto.userId,
      displayName: validation.displayName,
    });

    if (!user) {
      return {
        statusCode: 404,
        body: {
          success: false,
          message: 'User not found',
        },
      };
    }

    await this.adminUserDisplayNameGateway.logDisplayNameUpdate({
      user,
      displayName: validation.displayName,
      actorId: dto.actorId,
      ipAddress: dto.ipAddress,
      userAgent: dto.userAgent,
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        data: user,
        message: 'Display name updated successfully',
      },
    };
  }
}
