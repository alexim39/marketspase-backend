import { UserModel } from '../../models/user/index.js';
import { UserRoleGateway } from '../../application/ports/user-role.gateway.js';

export class MongooseUserRoleGateway extends UserRoleGateway {
  constructor({ userModel = UserModel } = {}) {
    super();
    this.userModel = userModel;
  }

  async findUserById(userId) {
    return this.userModel.findById(userId);
  }

  async updateUserRole({ userId, role, activity } = {}) {
    return this.userModel.updateOne(
      { _id: userId },
      {
        $set: { role },
        $push: { activityLog: { $each: [activity], $position: 0, $slice: 1000 } },
      },
    );
  }
}
