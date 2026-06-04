export class LoginStreakQueryGateway {
  async getLoginStreakStatus(_userId) {
    throw new Error('LoginStreakQueryGateway.getLoginStreakStatus must be implemented');
  }

  async getLeaderboard(_currentUserId, _query = {}) {
    throw new Error('LoginStreakQueryGateway.getLeaderboard must be implemented');
  }
}
