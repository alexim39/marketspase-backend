export class DashboardBannerMessageGateway {
  async getActiveBannerMessages(_query = {}) {
    throw new Error('DashboardBannerMessageGateway.getActiveBannerMessages must be implemented');
  }

  async getDismissedBannerMessageIds(_userId) {
    throw new Error('DashboardBannerMessageGateway.getDismissedBannerMessageIds must be implemented');
  }

  async findBannerMessageById(_id) {
    throw new Error('DashboardBannerMessageGateway.findBannerMessageById must be implemented');
  }

  async dismissBannerMessage(_command = {}) {
    throw new Error('DashboardBannerMessageGateway.dismissBannerMessage must be implemented');
  }

  async createBannerMessage(_data = {}) {
    throw new Error('DashboardBannerMessageGateway.createBannerMessage must be implemented');
  }

  async updateBannerMessage(_command = {}) {
    throw new Error('DashboardBannerMessageGateway.updateBannerMessage must be implemented');
  }

  async deleteBannerMessage(_id) {
    throw new Error('DashboardBannerMessageGateway.deleteBannerMessage must be implemented');
  }
}
