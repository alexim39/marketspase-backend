import { UpdateAdminBadgeConfigDto } from '../dto/update-admin-badge-config.dto.js';

export class UpdateAdminBadgeConfigUseCase {
  constructor({ badgeAdminConfigGateway } = {}) {
    if (!badgeAdminConfigGateway) {
      throw new Error('badgeAdminConfigGateway is required');
    }

    this.badgeAdminConfigGateway = badgeAdminConfigGateway;
  }

  async execute(input) {
    const dto = input instanceof UpdateAdminBadgeConfigDto
      ? input
      : new UpdateAdminBadgeConfigDto(input);

    return this.badgeAdminConfigGateway.updateAdminBadgeConfig(dto.adminId, dto.payload);
  }
}
