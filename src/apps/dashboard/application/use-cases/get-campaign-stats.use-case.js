export class GetCampaignStatsUseCase {
  constructor({ dashboardStatsGateway } = {}) {
    if (!dashboardStatsGateway) {
      throw new Error('dashboardStatsGateway is required');
    }

    this.dashboardStatsGateway = dashboardStatsGateway;
  }

  async execute() {
    return this.dashboardStatsGateway.getCampaignStats();
  }
}
