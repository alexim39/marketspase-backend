import { UserModel } from '../../models/user/index.js';
import { PublicIdentityGateway } from '../../application/ports/public-identity.gateway.js';

export class MongoosePublicIdentityGateway extends PublicIdentityGateway {
  constructor({ userModel = UserModel } = {}) {
    super();
    this.userModel = userModel;
  }

  async findExistingUsername({ username, excludedUserId } = {}) {
    return this.userModel.findOne({
      username,
      _id: { $ne: excludedUserId },
    }).lean();
  }

  async updatePublicIdentity({ userId, updateFields } = {}) {
    return this.userModel.findByIdAndUpdate(
      userId,
      { $set: updateFields },
      { new: true, runValidators: true, context: 'query' },
    );
  }

  async logPublicIdentityUpdate({ user, updatedFields = [] } = {}) {
    if (typeof user?.logActivity !== 'function') {
      return null;
    }

    return user.logActivity(
      'profile_update',
      'You updated your public identity and linked social profiles',
      {
        updatedFields,
      },
    );
  }
}
