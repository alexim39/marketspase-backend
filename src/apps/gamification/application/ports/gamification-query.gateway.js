export class GamificationQueryGateway {
  async getGamificationDashboard(_userId) {
    throw new Error('GamificationQueryGateway.getGamificationDashboard must be implemented');
  }

  async getGamificationFeed(_userId) {
    throw new Error('GamificationQueryGateway.getGamificationFeed must be implemented');
  }
}
