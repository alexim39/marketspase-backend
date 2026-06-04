import mongoose from 'mongoose';

import { UserModel } from '../../models/user/index.js';
import { AdminUserLifecycleGateway } from '../../application/ports/admin-user-lifecycle.gateway.js';

export class MongooseAdminUserLifecycleGateway extends AdminUserLifecycleGateway {
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

  async softDeleteUser({ user, actorId, deletedAt } = {}) {
    user.isDeleted = true;
    user.deletedAt = deletedAt;
    user.deletedBy = actorId || 'system';
    await user.save();
    return user;
  }

  async logUserDeleted({ user, actorId, deletedAt } = {}) {
    return user.logActivity(
      'user_deleted',
      'User account soft deleted',
      {
        resourceType: 'user',
        resourceId: user._id,
        performedBy: actorId || 'system',
        metadata: { deletedAt },
      }
    );
  }

  async restoreUser({ user } = {}) {
    user.isDeleted = false;
    user.deletedAt = undefined;
    user.deletedBy = undefined;
    await user.save();
    return user;
  }

  async logUserRestored({ user, actorId } = {}) {
    return user.logActivity(
      'user_restored',
      'User account restored',
      {
        resourceType: 'user',
        resourceId: user._id,
        performedBy: actorId || 'system',
      }
    );
  }
}
