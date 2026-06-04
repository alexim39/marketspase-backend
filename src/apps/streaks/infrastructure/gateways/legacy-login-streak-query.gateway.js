import { LoginStreakQueryGateway } from '../../application/ports/login-streak-query.gateway.js';
import {
  getLeaderboard,
  getLoginStreakStatus,
} from '../../service/login-streak.service.js';

export class LegacyLoginStreakQueryGateway extends LoginStreakQueryGateway {
  async getLoginStreakStatus(userId) {
    return getLoginStreakStatus(userId);
  }

  async getLeaderboard(currentUserId, query = {}) {
    return getLeaderboard(currentUserId, query);
  }
}
