export class UserRoleGateway {
  async findUserById(_userId) {
    throw new Error('UserRoleGateway.findUserById must be implemented');
  }

  async updateUserRole(_command = {}) {
    throw new Error('UserRoleGateway.updateUserRole must be implemented');
  }
}
