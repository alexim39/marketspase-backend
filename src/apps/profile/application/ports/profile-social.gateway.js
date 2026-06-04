export class ProfileSocialGateway {
  isValidObjectId(_value) {
    throw new Error('ProfileSocialGateway.isValidObjectId must be implemented');
  }

  async findProfileUser(_query = {}) {
    throw new Error('ProfileSocialGateway.findProfileUser must be implemented');
  }

  async getBaseProfileStats(_query = {}) {
    throw new Error('ProfileSocialGateway.getBaseProfileStats must be implemented');
  }

  async isFollowingUser(_query = {}) {
    throw new Error('ProfileSocialGateway.isFollowingUser must be implemented');
  }

  async refreshUserReputation(_query = {}) {
    throw new Error('ProfileSocialGateway.refreshUserReputation must be implemented');
  }

  async getDetailedProfileSocialStats(_query = {}) {
    throw new Error('ProfileSocialGateway.getDetailedProfileSocialStats must be implemented');
  }

  async buildMarketerProfile(_query = {}) {
    throw new Error('ProfileSocialGateway.buildMarketerProfile must be implemented');
  }

  async buildPromoterProfile(_query = {}) {
    throw new Error('ProfileSocialGateway.buildPromoterProfile must be implemented');
  }

  async listUserPosts(_query = {}) {
    throw new Error('ProfileSocialGateway.listUserPosts must be implemented');
  }

  async listFollowers(_query = {}) {
    throw new Error('ProfileSocialGateway.listFollowers must be implemented');
  }

  async listFollowing(_query = {}) {
    throw new Error('ProfileSocialGateway.listFollowing must be implemented');
  }

  async listSuggestedUsers(_query = {}) {
    throw new Error('ProfileSocialGateway.listSuggestedUsers must be implemented');
  }

  async findFollow(_query = {}) {
    throw new Error('ProfileSocialGateway.findFollow must be implemented');
  }

  async deleteFollow(_follow) {
    throw new Error('ProfileSocialGateway.deleteFollow must be implemented');
  }

  async createFollow(_command = {}) {
    throw new Error('ProfileSocialGateway.createFollow must be implemented');
  }
}
