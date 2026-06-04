import { buildProfessionalProfileUpdateFields } from '../../domain/services/professional-profile-normalizer.js';
import { UpdateProfessionalProfileDto } from '../dto/update-professional-profile.dto.js';

export class UpdateProfessionalProfileUseCase {
  constructor({ professionalProfileGateway } = {}) {
    if (!professionalProfileGateway) {
      throw new Error('professionalProfileGateway is required');
    }

    this.professionalProfileGateway = professionalProfileGateway;
  }

  async execute(input) {
    const dto = input instanceof UpdateProfessionalProfileDto
      ? input
      : new UpdateProfessionalProfileDto(input);

    if (!dto.userId) {
      return {
        statusCode: 400,
        body: {
          success: false,
          message: 'User ID is required.',
        },
      };
    }

    if (!this.professionalProfileGateway.isValidObjectId(dto.userId)) {
      return {
        statusCode: 400,
        body: {
          success: false,
          message: 'Invalid user ID.',
        },
      };
    }

    const updateFields = buildProfessionalProfileUpdateFields(dto.body);

    if (Object.keys(updateFields).length === 0) {
      return {
        statusCode: 400,
        body: {
          success: false,
          message: 'No fields to update.',
        },
      };
    }

    const updatedUser = await this.professionalProfileGateway.updateProfessionalProfile({
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

    await this.professionalProfileGateway.logProfessionalProfileUpdate({
      user: updatedUser,
      updatedFields: Object.keys(updateFields),
    });

    return {
      statusCode: 200,
      body: {
        message: 'Professional information updated successfully!',
        success: true,
      },
    };
  }
}
