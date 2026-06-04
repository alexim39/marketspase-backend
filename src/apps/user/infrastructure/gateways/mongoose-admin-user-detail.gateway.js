import mongoose from 'mongoose';

import { UserModel } from '../../models/user/index.js';
import { AdminUserDetailGateway } from '../../application/ports/admin-user-detail.gateway.js';

export class MongooseAdminUserDetailGateway extends AdminUserDetailGateway {
  constructor({ userModel = UserModel } = {}) {
    super();
    this.userModel = userModel;
  }

  isValidUserId(userId) {
    return mongoose.Types.ObjectId.isValid(userId);
  }

  async findUserDetailById(userId) {
    return this.userModel.findById(userId)
      .select('-password -deviceTokens -sseConnections -activityLog')
      .lean();
  }
}
