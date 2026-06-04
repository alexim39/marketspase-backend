import { UpdateBadgeDefinitionDto } from '../dto/update-badge-definition.dto.js';

export class UpdateBadgeDefinitionUseCase {
  constructor({ badgeDefinitionGateway } = {}) {
    if (!badgeDefinitionGateway) {
      throw new Error('badgeDefinitionGateway is required');
    }

    this.badgeDefinitionGateway = badgeDefinitionGateway;
  }

  async execute(input) {
    const dto = input instanceof UpdateBadgeDefinitionDto
      ? input
      : new UpdateBadgeDefinitionDto(input);

    return this.badgeDefinitionGateway.updateBadgeDefinition(dto.adminId, dto.badgeId, dto.payload);
  }
}
