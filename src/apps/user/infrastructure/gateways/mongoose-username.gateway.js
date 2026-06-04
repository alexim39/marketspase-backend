import mongoose from 'mongoose';
import { UserModel } from '../../models/user/index.js';
import { UsernameGateway } from '../../application/ports/username.gateway.js';

export class MongooseUsernameGateway extends UsernameGateway {
  constructor({
    userModel = UserModel,
    mongooseConnection = mongoose,
  } = {}) {
    super();
    this.userModel = userModel;
    this.mongoose = mongooseConnection;
  }

  async updateUsername({ userId, username } = {}) {
    const session = await this.mongoose.startSession();
    session.startTransaction();

    try {
      const user = await this.userModel.findById(userId).session(session);
      if (!user) {
        await session.abortTransaction();
        session.endSession();
        return { status: 'not-found' };
      }

      const existingUser = await this.userModel.findOne({ username }).session(session);
      if (existingUser && existingUser._id.toString() !== user._id.toString()) {
        await session.abortTransaction();
        session.endSession();
        return { status: 'duplicate' };
      }

      user.username = username;
      user.referralInfo.referralCode = username;
      await user.save({ session });

      await session.commitTransaction();
      session.endSession();

      return {
        status: 'updated',
        user,
      };
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  async logUsernameUpdate({ user, username } = {}) {
    if (typeof user?.logActivity !== 'function') {
      return null;
    }

    return user.logActivity(
      'profile_update',
      `You updated your profile username to ${username}`,
      {},
    );
  }
}
