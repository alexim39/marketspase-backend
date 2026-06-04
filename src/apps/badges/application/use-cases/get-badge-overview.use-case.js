import { GetBadgeOverviewDto } from '../dto/get-badge-overview.dto.js';

export class GetBadgeOverviewUseCase {
  constructor({ badgeQueryGateway } = {}) {
    if (!badgeQueryGateway) {
      throw new Error('badgeQueryGateway is required');
    }

    this.badgeQueryGateway = badgeQueryGateway;
  }

  async execute(input) {
    const dto = input instanceof GetBadgeOverviewDto ? input : new GetBadgeOverviewDto(input);
    return this.badgeQueryGateway.getUserBadgeOverview(dto.viewerUserId, dto.targetUserId);
  }
}
