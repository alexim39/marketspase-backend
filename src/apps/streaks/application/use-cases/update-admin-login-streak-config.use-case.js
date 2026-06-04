import { UpdateAdminLoginStreakConfigDto } from '../dto/update-admin-login-streak-config.dto.js';

export class UpdateAdminLoginStreakConfigUseCase {
  constructor({ loginStreakAdminConfigGateway } = {}) {
    if (!loginStreakAdminConfigGateway) {
      throw new Error('loginStreakAdminConfigGateway is required');
    }

    this.loginStreakAdminConfigGateway = loginStreakAdminConfigGateway;
  }

  async execute(input) {
    const dto = input instanceof UpdateAdminLoginStreakConfigDto
      ? input
      : new UpdateAdminLoginStreakConfigDto(input);

    return this.loginStreakAdminConfigGateway.updateAdminLoginStreakConfig(dto.adminId, dto.payload);
  }
}
