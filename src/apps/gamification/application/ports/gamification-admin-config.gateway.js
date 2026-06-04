export class GamificationAdminConfigGateway {
  async getAdminGamificationConfig() {
    throw new Error('GamificationAdminConfigGateway.getAdminGamificationConfig must be implemented');
  }

  async updateAdminGamificationConfig(_adminId, _payload = {}) {
    throw new Error('GamificationAdminConfigGateway.updateAdminGamificationConfig must be implemented');
  }
}
