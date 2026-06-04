export class GetAdminLoginStreakConfigUseCase {
  constructor({ loginStreakAdminConfigGateway } = {}) {
    if (!loginStreakAdminConfigGateway) {
      throw new Error('loginStreakAdminConfigGateway is required');
    }

    this.loginStreakAdminConfigGateway = loginStreakAdminConfigGateway;
  }

  async execute() {
    return this.loginStreakAdminConfigGateway.getAdminLoginStreakConfig();
  }
}
