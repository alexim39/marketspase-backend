import mongoose from 'mongoose';
import { UserModel } from '../../models/user/index.js';
import { PersonalProfileGateway } from '../../application/ports/personal-profile.gateway.js';

export class MongoosePersonalProfileGateway extends PersonalProfileGateway {
  constructor({ userModel = UserModel, mongooseConnection = mongoose } = {}) {
    super();
    this.userModel = userModel;
    this.mongoose = mongooseConnection;
  }

  isValidObjectId(value) {
    return this.mongoose.Types.ObjectId.isValid(value);
  }

  async findUserById(userId) {
    return this.userModel.findById(userId).lean();
  }

  async findUserByEmail({ email, excludedUserId } = {}) {
    return this.userModel.findOne({
      email,
      _id: { $ne: excludedUserId },
    }).lean();
  }

  async findUserByPhone({ phone, excludedUserId } = {}) {
    return this.userModel.findOne({
      'personalInfo.phone': phone,
      _id: { $ne: excludedUserId },
    }).lean();
  }

  async updatePersonalProfile({ userId, updateData } = {}) {
    return this.userModel.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true, context: 'query' },
    ).select('-password');
  }

  async logPersonalProfileUpdate({ user } = {}) {
    if (typeof user?.logActivity !== 'function') {
      return null;
    }

    return user.logActivity('profile_update', 'You updated your profile details', {});
  }
}
