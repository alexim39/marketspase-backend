import { PingLoginStreakSessionDto } from '../dto/ping-login-streak-session.dto.js';

export class PingLoginStreakSessionUseCase {
  constructor({ loginStreakSessionGateway } = {}) {
    if (!loginStreakSessionGateway) {
      throw new Error('loginStreakSessionGateway is required');
    }

    this.loginStreakSessionGateway = loginStreakSessionGateway;
  }

  async execute(input) {
    const dto = input instanceof PingLoginStreakSessionDto
      ? input
      : new PingLoginStreakSessionDto(input);

    return this.loginStreakSessionGateway.pingLoginStreakSession(dto.userId, dto.sessionId, dto.metadata);
  }
}
