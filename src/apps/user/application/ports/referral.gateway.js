export class ReferralGateway {
  async findUserById(_userId) {
    throw new Error('ReferralGateway.findUserById must be implemented');
  }

  async findReferralUser(_userId) {
    throw new Error('ReferralGateway.findReferralUser must be implemented');
  }

  async getUserReferralStats(_userId) {
    throw new Error('ReferralGateway.getUserReferralStats must be implemented');
  }

  async findUsersByIds(_userIds = []) {
    throw new Error('ReferralGateway.findUsersByIds must be implemented');
  }

  async findReferralCodeOwner(_referralCode) {
    throw new Error('ReferralGateway.findReferralCodeOwner must be implemented');
  }
}
