import { GetDismissedBannerMessagesDto } from '../dto/get-dismissed-banner-messages.dto.js';

export class GetDismissedBannerMessagesUseCase {
  constructor({ dashboardBannerMessageGateway } = {}) {
    if (!dashboardBannerMessageGateway) {
      throw new Error('dashboardBannerMessageGateway is required');
    }

    this.dashboardBannerMessageGateway = dashboardBannerMessageGateway;
  }

  async execute(input) {
    const dto = input instanceof GetDismissedBannerMessagesDto
      ? input
      : new GetDismissedBannerMessagesDto(input);

    if (!dto.userId) {
      return {
        statusCode: 400,
        body: {
          success: false,
          data: [],
          message: 'User ID is required',
        },
      };
    }

    const data = await this.dashboardBannerMessageGateway.getDismissedBannerMessageIds(dto.userId);

    return {
      statusCode: 200,
      body: {
        success: true,
        data,
      },
    };
  }
}
