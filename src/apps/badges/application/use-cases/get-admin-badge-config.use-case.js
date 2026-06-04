export class GetAdminBadgeConfigUseCase {
  constructor({ badgeAdminConfigGateway } = {}) {
    if (!badgeAdminConfigGateway) {
      throw new Error('badgeAdminConfigGateway is required');
    }

    this.badgeAdminConfigGateway = badgeAdminConfigGateway;
  }

  async execute() {
    return this.badgeAdminConfigGateway.getAdminBadgeConfig();
  }
}
