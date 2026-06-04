import { WithdrawLoginStreakPointsDto } from '../dto/withdraw-login-streak-points.dto.js';

export class WithdrawLoginStreakPointsUseCase {
  constructor({ loginStreakWithdrawalGateway } = {}) {
    if (!loginStreakWithdrawalGateway) {
      throw new Error('loginStreakWithdrawalGateway is required');
    }

    this.loginStreakWithdrawalGateway = loginStreakWithdrawalGateway;
  }

  async execute(input) {
    const dto = input instanceof WithdrawLoginStreakPointsDto
      ? input
      : new WithdrawLoginStreakPointsDto(input);

    return this.loginStreakWithdrawalGateway.withdrawLoginStreakPoints(dto.userId, dto.payload);
  }
}
