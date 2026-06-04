import { CreateBannerMessageDto } from '../dto/create-banner-message.dto.js';

export class CreateBannerMessageUseCase {
  constructor({ dashboardBannerMessageGateway } = {}) {
    if (!dashboardBannerMessageGateway) {
      throw new Error('dashboardBannerMessageGateway is required');
    }

    this.dashboardBannerMessageGateway = dashboardBannerMessageGateway;
  }

  async execute(input) {
    const dto = input instanceof CreateBannerMessageDto
      ? input
      : new CreateBannerMessageDto(input);

    const data = await this.dashboardBannerMessageGateway.createBannerMessage(dto.data);

    return {
      statusCode: 201,
      body: {
        success: true,
        data,
        message: 'Notification created successfully',
      },
    };
  }
}
