import { LoginStreakSessionGateway } from '../../application/ports/login-streak-session.gateway.js';
import {
  pingLoginStreakSession,
  startLoginStreakSession,
} from '../../service/login-streak.service.js';

export class LegacyLoginStreakSessionGateway extends LoginStreakSessionGateway {
  async startLoginStreakSession(userId, metadata = {}) {
    return startLoginStreakSession(userId, metadata);
  }

  async pingLoginStreakSession(userId, sessionId = null, metadata = {}) {
    return pingLoginStreakSession(userId, sessionId, metadata);
  }
}
