import { GetLoginStreakLeaderboardDto } from '../dto/get-login-streak-leaderboard.dto.js';

export class GetLoginStreakLeaderboardUseCase {
  constructor({ loginStreakQueryGateway } = {}) {
    if (!loginStreakQueryGateway) {
      throw new Error('loginStreakQueryGateway is required');
    }

    this.loginStreakQueryGateway = loginStreakQueryGateway;
  }

  async execute(input) {
    const dto = input instanceof GetLoginStreakLeaderboardDto
      ? input
      : new GetLoginStreakLeaderboardDto(input);

    return this.loginStreakQueryGateway.getLeaderboard(dto.userId, dto.query);
  }
}
