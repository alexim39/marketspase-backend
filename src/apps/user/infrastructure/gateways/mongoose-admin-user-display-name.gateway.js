import mongoose from 'mongoose';

import { AdminUserDisplayNameGateway } from '../../application/ports/admin-user-display-name.gateway.js';
import { UserModel } from '../../models/user/index.js';

export class MongooseAdminUserDisplayNameGateway extends AdminUserDisplayNameGateway {
  constructor({ userModel = UserModel } = {}) {
    super();
    this.userModel = userModel;
  }

  isValidUserId(userId) {
    return mongoose.Types.ObjectId.isValid(userId);
  }

  async updateDisplayName({ userId, displayName } = {}) {
    return this.userModel
      .findByIdAndUpdate(
        userId,
        { displayName },
        { new: true, runValidators: true },
      )
      .select('-password -__v -authenticationMethod')
      .exec();
  }

  async logDisplayNameUpdate({
    user,
    displayName,
    actorId = 'system',
    ipAddress = null,
    userAgent = null,
  } = {}) {
    if (typeof user?.logActivity !== 'function') {
      return null;
    }

    return user.logActivity(
      'display_name_updated',
      `Display name updated to "${displayName}"`,
      {
        resourceType: 'user',
        resourceId: user._id,
        metadata: {
          updatedBy: actorId || 'system',
          ipAddress,
          userAgent,
        },
        ipAddress,
        userAgent,
      },
    );
  }
}
