import mongoose from 'mongoose';
import { UserModel } from '../../models/user/index.js';
import { ProfessionalProfileGateway } from '../../application/ports/professional-profile.gateway.js';

export class MongooseProfessionalProfileGateway extends ProfessionalProfileGateway {
  constructor({ userModel = UserModel } = {}) {
    super();
    this.userModel = userModel;
  }

  isValidObjectId(value) {
    return mongoose.Types.ObjectId.isValid(value);
  }

  async updateProfessionalProfile({ userId, updateFields } = {}) {
    return this.userModel.findByIdAndUpdate(
      userId,
      { $set: updateFields },
      { new: true, runValidators: true },
    );
  }

  async logProfessionalProfileUpdate({ user, updatedFields = [] } = {}) {
    if (typeof user?.logActivity !== 'function') {
      return null;
    }

    return user.logActivity(
      'profile_professional_update',
      'You updated your public profile and professional information',
      {
        updatedFields,
      },
    );
  }
}
