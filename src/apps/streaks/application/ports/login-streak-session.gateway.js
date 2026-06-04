export class LoginStreakSessionGateway {
  async startLoginStreakSession(_userId, _metadata = {}) {
    throw new Error('LoginStreakSessionGateway.startLoginStreakSession must be implemented');
  }

  async pingLoginStreakSession(_userId, _sessionId = null, _metadata = {}) {
    throw new Error('LoginStreakSessionGateway.pingLoginStreakSession must be implemented');
  }
}
