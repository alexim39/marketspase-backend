import { GetMyBadgeFeedDto } from '../dto/get-my-badge-feed.dto.js';

export class GetMyBadgeFeedUseCase {
  constructor({ badgeQueryGateway } = {}) {
    if (!badgeQueryGateway) {
      throw new Error('badgeQueryGateway is required');
    }

    this.badgeQueryGateway = badgeQueryGateway;
  }

  async execute(input) {
    const dto = input instanceof GetMyBadgeFeedDto ? input : new GetMyBadgeFeedDto(input);
    return this.badgeQueryGateway.getMyBadgeFeed(dto.userId, dto.query);
  }
}
