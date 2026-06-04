import { UpdateAdminGamificationConfigDto } from '../dto/update-admin-gamification-config.dto.js';

export class UpdateAdminGamificationConfigUseCase {
  constructor({ gamificationAdminConfigGateway } = {}) {
    if (!gamificationAdminConfigGateway) {
      throw new Error('gamificationAdminConfigGateway is required');
    }

    this.gamificationAdminConfigGateway = gamificationAdminConfigGateway;
  }

  async execute(input) {
    const dto = input instanceof UpdateAdminGamificationConfigDto
      ? input
      : new UpdateAdminGamificationConfigDto(input);

    return this.gamificationAdminConfigGateway.updateAdminGamificationConfig(dto.adminId, dto.payload);
  }
}
