export class BadgeAdminConfigGateway {
  async getAdminBadgeConfig() {
    throw new Error('BadgeAdminConfigGateway.getAdminBadgeConfig must be implemented');
  }

  async updateAdminBadgeConfig(_adminId, _payload = {}) {
    throw new Error('BadgeAdminConfigGateway.updateAdminBadgeConfig must be implemented');
  }
}
