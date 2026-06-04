import { GetLoginStreakStatusDto } from '../dto/get-login-streak-status.dto.js';

export class GetLoginStreakStatusUseCase {
  constructor({ loginStreakQueryGateway } = {}) {
    if (!loginStreakQueryGateway) {
      throw new Error('loginStreakQueryGateway is required');
    }

    this.loginStreakQueryGateway = loginStreakQueryGateway;
  }

  async execute(input) {
    const dto = input instanceof GetLoginStreakStatusDto
      ? input
      : new GetLoginStreakStatusDto(input);

    return this.loginStreakQueryGateway.getLoginStreakStatus(dto.userId);
  }
}
