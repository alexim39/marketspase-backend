export class AdminUserStatusGateway {
  isValidUserId(_userId) {
    throw new Error('AdminUserStatusGateway.isValidUserId must be implemented');
  }

  async findUserById(_userId) {
    throw new Error('AdminUserStatusGateway.findUserById must be implemented');
  }

  async saveUserActiveStatus(_command = {}) {
    throw new Error('AdminUserStatusGateway.saveUserActiveStatus must be implemented');
  }

  async logUserStatusChange(_command = {}) {
    throw new Error('AdminUserStatusGateway.logUserStatusChange must be implemented');
  }
}
