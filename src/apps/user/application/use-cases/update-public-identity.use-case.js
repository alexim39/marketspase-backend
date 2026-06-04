import { buildPublicIdentityUpdateFields } from '../../domain/services/public-identity-normalizer.js';
import { UpdatePublicIdentityDto } from '../dto/update-public-identity.dto.js';

export class UpdatePublicIdentityUseCase {
  constructor({ publicIdentityGateway } = {}) {
    if (!publicIdentityGateway) {
      throw new Error('publicIdentityGateway is required');
    }

    this.publicIdentityGateway = publicIdentityGateway;
  }

  async execute(input) {
    const dto = input instanceof UpdatePublicIdentityDto ? input : new UpdatePublicIdentityDto(input);

    if (!dto.userId) {
      return {
        statusCode: 401,
        body: {
          success: false,
          message: 'Authentication required.',
        },
      };
    }

    const { updateFields, error } = buildPublicIdentityUpdateFields(dto.body);

    if (error) {
      return error;
    }

    if (Object.keys(updateFields).length === 0) {
      return {
        statusCode: 400,
        body: {
          success: false,
          message: 'No public identity fields were provided.',
        },
      };
    }

    if (updateFields.username) {
      const existingUser = await this.publicIdentityGateway.findExistingUsername({
        username: updateFields.username,
        excludedUserId: dto.userId,
      });

      if (existingUser) {
        return {
          statusCode: 409,
          body: {
            success: false,
            message: 'Username is already in use by another user.',
          },
        };
      }
    }

    const updatedUser = await this.publicIdentityGateway.updatePublicIdentity({
      userId: dto.userId,
      updateFields,
    });

    if (!updatedUser) {
      return {
        statusCode: 404,
        body: {
          success: false,
          message: 'User not found.',
        },
      };
    }

    await this.publicIdentityGateway.logPublicIdentityUpdate({
      user: updatedUser,
      updatedFields: Object.keys(updateFields),
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        message: 'Public identity updated successfully.',
      },
    };
  }
}
