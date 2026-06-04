export class GetAdminGamificationConfigUseCase {
  constructor({ gamificationAdminConfigGateway } = {}) {
    if (!gamificationAdminConfigGateway) {
      throw new Error('gamificationAdminConfigGateway is required');
    }

    this.gamificationAdminConfigGateway = gamificationAdminConfigGateway;
  }

  async execute() {
    return this.gamificationAdminConfigGateway.getAdminGamificationConfig();
  }
}
