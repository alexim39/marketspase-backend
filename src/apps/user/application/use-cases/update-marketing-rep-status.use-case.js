import { UpdateMarketingRepStatusDto } from '../dto/update-marketing-rep-status.dto.js';

export class UpdateMarketingRepStatusUseCase {
  constructor({ adminMarketingRepGateway } = {}) {
    if (!adminMarketingRepGateway) {
      throw new Error('adminMarketingRepGateway is required');
    }

    this.adminMarketingRepGateway = adminMarketingRepGateway;
  }

  async execute(input) {
    const dto = input instanceof UpdateMarketingRepStatusDto
      ? input
      : new UpdateMarketingRepStatusDto(input);

    const updateData = { isMarketingRep: dto.newValue };

    if (!dto.newValue) {
      updateData.role = 'promoter';
    }

    const updatedUser = await this.adminMarketingRepGateway.updateMarketingRepStatus({
      userId: dto.userId,
      updateData,
    });

    if (!updatedUser) {
      return {
        statusCode: 404,
        body: {
          success: false,
          message: 'User not found',
        },
      };
    }

    return {
      statusCode: 200,
      body: {
        success: true,
        message: `User has been ${dto.newValue ? 'promoted to' : 'removed from'} Marketing Rep status.`,
        user: updatedUser,
      },
      meta: {
        userId: dto.userId,
        newValue: dto.newValue,
      },
    };
  }
}
