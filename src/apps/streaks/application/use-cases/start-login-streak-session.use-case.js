import { StartLoginStreakSessionDto } from '../dto/start-login-streak-session.dto.js';

export class StartLoginStreakSessionUseCase {
  constructor({ loginStreakSessionGateway } = {}) {
    if (!loginStreakSessionGateway) {
      throw new Error('loginStreakSessionGateway is required');
    }

    this.loginStreakSessionGateway = loginStreakSessionGateway;
  }

  async execute(input) {
    const dto = input instanceof StartLoginStreakSessionDto
      ? input
      : new StartLoginStreakSessionDto(input);

    return this.loginStreakSessionGateway.startLoginStreakSession(dto.userId, dto.metadata);
  }
}
