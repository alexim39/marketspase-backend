export class AdminUserDetailGateway {
  isValidUserId(_userId) {
    throw new Error('AdminUserDetailGateway.isValidUserId must be implemented');
  }

  async findUserDetailById(_userId) {
    throw new Error('AdminUserDetailGateway.findUserDetailById must be implemented');
  }
}
