export class DashboardStatsGateway {
  async getCampaignStats() {
    throw new Error('DashboardStatsGateway.getCampaignStats must be implemented');
  }

  async getUserStats() {
    throw new Error('DashboardStatsGateway.getUserStats must be implemented');
  }

  async getRevenueStats() {
    throw new Error('DashboardStatsGateway.getRevenueStats must be implemented');
  }

  async getEngagementStats() {
    throw new Error('DashboardStatsGateway.getEngagementStats must be implemented');
  }

  async getAdminOverviewStats() {
    throw new Error('DashboardStatsGateway.getAdminOverviewStats must be implemented');
  }
}
