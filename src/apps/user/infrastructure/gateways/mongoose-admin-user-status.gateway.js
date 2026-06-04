import mongoose from 'mongoose';

import { UserModel } from '../../models/user/index.js';
import { AdminUserStatusGateway } from '../../application/ports/admin-user-status.gateway.js';

export class MongooseAdminUserStatusGateway extends AdminUserStatusGateway {
  constructor({ userModel = UserModel } = {}) {
    super();
    this.userModel = userModel;
  }

  isValidUserId(userId) {
    return mongoose.Types.ObjectId.isValid(userId);
  }

  async findUserById(userId) {
    return this.userModel.findById(userId);
  }

  async saveUserActiveStatus({ user, isActive } = {}) {
    user.isActive = isActive;
    await user.save();
    return user;
  }

  async logUserStatusChange({ user, isActive, actorId } = {}) {
    return user.logActivity(
      'account_suspend',
      `User status changed to ${isActive ? 'active' : 'inactive'}`,
      {
        resourceType: 'user',
        resourceId: user._id,
        performedBy: actorId || 'system',
        metadata: { isActive },
      }
    );
  }
}
