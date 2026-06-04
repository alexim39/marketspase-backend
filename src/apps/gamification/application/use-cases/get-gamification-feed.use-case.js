import { GetGamificationFeedDto } from '../dto/get-gamification-feed.dto.js';

export class GetGamificationFeedUseCase {
  constructor({ gamificationQueryGateway } = {}) {
    if (!gamificationQueryGateway) {
      throw new Error('gamificationQueryGateway is required');
    }

    this.gamificationQueryGateway = gamificationQueryGateway;
  }

  async execute(input) {
    const dto = input instanceof GetGamificationFeedDto
      ? input
      : new GetGamificationFeedDto(input);

    return this.gamificationQueryGateway.getGamificationFeed(dto.userId);
  }
}
