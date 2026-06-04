import { UpdateBannerMessageDto } from '../dto/update-banner-message.dto.js';

export class UpdateBannerMessageUseCase {
  constructor({ dashboardBannerMessageGateway } = {}) {
    if (!dashboardBannerMessageGateway) {
      throw new Error('dashboardBannerMessageGateway is required');
    }

    this.dashboardBannerMessageGateway = dashboardBannerMessageGateway;
  }

  async execute(input) {
    const dto = input instanceof UpdateBannerMessageDto
      ? input
      : new UpdateBannerMessageDto(input);

    const data = await this.dashboardBannerMessageGateway.updateBannerMessage({
      id: dto.id,
      data: dto.data,
    });

    if (!data) {
      return {
        statusCode: 404,
        body: {
          success: false,
          message: 'Notification not found',
        },
      };
    }

    return {
      statusCode: 200,
      body: {
        success: true,
        data,
        message: 'Notification updated successfully',
      },
    };
  }
}
