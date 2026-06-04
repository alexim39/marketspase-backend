export class DashboardActivityGateway {
  async getUsersOnlineCount() {
    throw new Error('DashboardActivityGateway.getUsersOnlineCount must be implemented');
  }

  async getLiveActivityFeed(_query = {}) {
    throw new Error('DashboardActivityGateway.getLiveActivityFeed must be implemented');
  }
}
