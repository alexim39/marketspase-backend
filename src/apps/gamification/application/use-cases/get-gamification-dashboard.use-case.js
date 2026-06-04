import { GetGamificationDashboardDto } from '../dto/get-gamification-dashboard.dto.js';

export class GetGamificationDashboardUseCase {
  constructor({ gamificationQueryGateway } = {}) {
    if (!gamificationQueryGateway) {
      throw new Error('gamificationQueryGateway is required');
    }

    this.gamificationQueryGateway = gamificationQueryGateway;
  }

  async execute(input) {
    const dto = input instanceof GetGamificationDashboardDto
      ? input
      : new GetGamificationDashboardDto(input);

    return this.gamificationQueryGateway.getGamificationDashboard(dto.userId);
  }
}
