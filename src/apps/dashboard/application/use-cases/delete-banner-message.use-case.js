import { DeleteBannerMessageDto } from '../dto/delete-banner-message.dto.js';

export class DeleteBannerMessageUseCase {
  constructor({ dashboardBannerMessageGateway } = {}) {
    if (!dashboardBannerMessageGateway) {
      throw new Error('dashboardBannerMessageGateway is required');
    }

    this.dashboardBannerMessageGateway = dashboardBannerMessageGateway;
  }

  async execute(input) {
    const dto = input instanceof DeleteBannerMessageDto
      ? input
      : new DeleteBannerMessageDto(input);

    const deleted = await this.dashboardBannerMessageGateway.deleteBannerMessage(dto.id);

    if (!deleted) {
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
        message: 'Notification deleted successfully',
      },
    };
  }
}
