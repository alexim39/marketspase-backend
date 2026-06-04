import { AdminUserListGateway } from '../../application/ports/admin-user-list.gateway.js';
import { UserModel } from '../../models/user/index.js';

export class MongooseAdminUserListGateway extends AdminUserListGateway {
  constructor({ userModel = UserModel } = {}) {
    super();
    this.userModel = userModel;
  }

  async findUsers({
    query = {},
    sort = {},
    projection = {},
    skip = 0,
    limit = 50,
  } = {}) {
    const [users, total] = await Promise.all([
      this.userModel
        .find(query)
        .select(projection)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      this.userModel.countDocuments(query),
    ]);

    return { users, total };
  }

  streamUsersForExport({
    query = {},
    projection = {},
    sort = { createdAt: -1 },
    batchSize = 100,
  } = {}) {
    return this.userModel
      .find(query)
      .select(projection)
      .sort(sort)
      .cursor({ batchSize });
  }
}
