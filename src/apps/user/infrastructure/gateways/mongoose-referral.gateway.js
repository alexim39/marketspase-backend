import { ReferralService } from '../../services/referral.service.js';
import { UserModel } from '../../models/user/index.js';
import { ReferralGateway } from '../../application/ports/referral.gateway.js';

export class MongooseReferralGateway extends ReferralGateway {
  constructor({
    userModel = UserModel,
    referralService = new ReferralService(),
  } = {}) {
    super();
    this.userModel = userModel;
    this.referralService = referralService;
  }

  async findUserById(userId) {
    return this.userModel.findById(userId);
  }

  async findReferralUser(userId) {
    return this.userModel.findById(userId)
      .select('referralInfo username')
      .lean();
  }

  async getUserReferralStats(userId) {
    return this.referralService.getUserReferralStats(userId);
  }

  async findUsersByIds(userIds = []) {
    if (!userIds.length) {
      return [];
    }

    return this.userModel.find({ _id: { $in: userIds } })
      .select('username displayName email role avatar createdAt')
      .lean();
  }

  async findReferralCodeOwner(referralCode) {
    return this.userModel.findOne({ username: referralCode })
      .select('username displayName')
      .lean();
  }
}
