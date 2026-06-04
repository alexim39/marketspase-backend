import { DismissBannerMessageDto } from '../dto/dismiss-banner-message.dto.js';

export class DismissBannerMessageUseCase {
  constructor({ dashboardBannerMessageGateway } = {}) {
    if (!dashboardBannerMessageGateway) {
      throw new Error('dashboardBannerMessageGateway is required');
    }

    this.dashboardBannerMessageGateway = dashboardBannerMessageGateway;
  }

  async execute(input) {
    const dto = input instanceof DismissBannerMessageDto
      ? input
      : new DismissBannerMessageDto(input);

    if (!dto.userId) {
      return {
        statusCode: 401,
        body: {
          success: false,
          message: 'User authentication required',
        },
      };
    }

    const notification = await this.dashboardBannerMessageGateway.findBannerMessageById(dto.notificationId);
    if (!notification) {
      return {
        statusCode: 404,
        body: {
          success: false,
          message: 'Notification not found',
        },
      };
    }

    await this.dashboardBannerMessageGateway.dismissBannerMessage({
      userId: dto.userId,
      notificationId: dto.notificationId,
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        message: 'Notification dismissed successfully',
      },
    };
  }
}
