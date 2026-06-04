import { GetActiveBannerMessagesDto } from '../dto/get-active-banner-messages.dto.js';

export class GetActiveBannerMessagesUseCase {
  constructor({ dashboardBannerMessageGateway } = {}) {
    if (!dashboardBannerMessageGateway) {
      throw new Error('dashboardBannerMessageGateway is required');
    }

    this.dashboardBannerMessageGateway = dashboardBannerMessageGateway;
  }

  async execute(input) {
    const dto = input instanceof GetActiveBannerMessagesDto
      ? input
      : new GetActiveBannerMessagesDto(input);

    const data = await this.dashboardBannerMessageGateway.getActiveBannerMessages({
      userId: dto.user?._id,
      isNewUser: Boolean(dto.user?.isNewUser),
      groups: dto.user?.groups || [],
      now: dto.now,
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        data,
        message: 'Active notifications retrieved successfully',
      },
    };
  }
}
