export class AdminUserListGateway {
  async findUsers(_query = {}) {
    throw new Error('AdminUserListGateway.findUsers must be implemented');
  }

  streamUsersForExport(_query = {}) {
    throw new Error('AdminUserListGateway.streamUsersForExport must be implemented');
  }
}
