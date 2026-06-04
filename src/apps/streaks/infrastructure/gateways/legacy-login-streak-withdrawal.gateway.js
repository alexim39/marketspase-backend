import { LoginStreakWithdrawalGateway } from '../../application/ports/login-streak-withdrawal.gateway.js';
import { withdrawLoginStreakPoints } from '../../service/login-streak.service.js';

export class LegacyLoginStreakWithdrawalGateway extends LoginStreakWithdrawalGateway {
  async withdrawLoginStreakPoints(userId, payload = {}) {
    return withdrawLoginStreakPoints(userId, payload);
  }
}
