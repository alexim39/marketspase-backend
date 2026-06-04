export class GetUserStatsUseCase {
  constructor({ dashboardStatsGateway } = {}) {
    if (!dashboardStatsGateway) {
      throw new Error('dashboardStatsGateway is required');
    }

    this.dashboardStatsGateway = dashboardStatsGateway;
  }

  async execute() {
    return this.dashboardStatsGateway.getUserStats();
  }
}
