import { GetLiveActivityFeedDto } from '../dto/get-live-activity-feed.dto.js';

export class GetLiveActivityFeedUseCase {
  constructor({ dashboardActivityGateway } = {}) {
    if (!dashboardActivityGateway) {
      throw new Error('dashboardActivityGateway is required');
    }

    this.dashboardActivityGateway = dashboardActivityGateway;
  }

  async execute(input) {
    const dto = input instanceof GetLiveActivityFeedDto
      ? input
      : new GetLiveActivityFeedDto(input);

    const data = await this.dashboardActivityGateway.getLiveActivityFeed(dto.query);
    return {
      success: true,
      data,
    };
  }
}
