export class AdminUserLifecycleGateway {
  isValidUserId(_userId) {
    throw new Error('AdminUserLifecycleGateway.isValidUserId must be implemented');
  }

  async findUserById(_userId) {
    throw new Error('AdminUserLifecycleGateway.findUserById must be implemented');
  }

  async softDeleteUser(_command = {}) {
    throw new Error('AdminUserLifecycleGateway.softDeleteUser must be implemented');
  }

  async logUserDeleted(_command = {}) {
    throw new Error('AdminUserLifecycleGateway.logUserDeleted must be implemented');
  }

  async restoreUser(_command = {}) {
    throw new Error('AdminUserLifecycleGateway.restoreUser must be implemented');
  }

  async logUserRestored(_command = {}) {
    throw new Error('AdminUserLifecycleGateway.logUserRestored must be implemented');
  }
}
