import { DeleteBadgeDefinitionDto } from '../dto/delete-badge-definition.dto.js';

export class DeleteBadgeDefinitionUseCase {
  constructor({ badgeDefinitionGateway } = {}) {
    if (!badgeDefinitionGateway) {
      throw new Error('badgeDefinitionGateway is required');
    }

    this.badgeDefinitionGateway = badgeDefinitionGateway;
  }

  async execute(input) {
    const dto = input instanceof DeleteBadgeDefinitionDto
      ? input
      : new DeleteBadgeDefinitionDto(input);

    return this.badgeDefinitionGateway.deleteBadgeDefinition(dto.adminId, dto.badgeId);
  }
}
