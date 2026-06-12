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
    return this.userModel.findByIdAndUpdate(
      user._id,
      { $set: { isActive } },
      { new: true },
    );
  }

  async logUserStatusChange({ user, isActive, actorId } = {}) {
    return this.userModel.updateOne(
      { _id: user._id },
      {
        $push: {
          activityLog: {
            $each: [{
              action: 'account_suspend',
              description: `User status changed to ${isActive ? 'active' : 'inactive'}`,
              resourceType: 'user',
              resourceId: user._id,
              metadata: {
                isActive,
                performedBy: actorId || 'system',
              },
              timestamp: new Date(),
            }],
            $position: 0,
            $slice: 1000,
          },
        },
      }
    );
  }
}
