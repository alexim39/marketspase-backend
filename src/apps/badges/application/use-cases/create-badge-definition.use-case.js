import { CreateBadgeDefinitionDto } from '../dto/create-badge-definition.dto.js';

export class CreateBadgeDefinitionUseCase {
  constructor({ badgeDefinitionGateway } = {}) {
    if (!badgeDefinitionGateway) {
      throw new Error('badgeDefinitionGateway is required');
    }

    this.badgeDefinitionGateway = badgeDefinitionGateway;
  }

  async execute(input) {
    const dto = input instanceof CreateBadgeDefinitionDto
      ? input
      : new CreateBadgeDefinitionDto(input);

    return this.badgeDefinitionGateway.createBadgeDefinition(dto.adminId, dto.payload);
  }
}
