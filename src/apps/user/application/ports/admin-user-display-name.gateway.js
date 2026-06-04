export class AdminUserDisplayNameGateway {
  isValidUserId(_userId) {
    throw new Error('AdminUserDisplayNameGateway.isValidUserId must be implemented');
  }

  async updateDisplayName(_command = {}) {
    throw new Error('AdminUserDisplayNameGateway.updateDisplayName must be implemented');
  }

  async logDisplayNameUpdate(_command = {}) {
    throw new Error('AdminUserDisplayNameGateway.logDisplayNameUpdate must be implemented');
  }
}
