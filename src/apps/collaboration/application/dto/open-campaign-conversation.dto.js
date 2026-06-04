export class OpenCampaignConversationDto {
  constructor({ user = null, campaignId = null } = {}) {
    this.user = user;
    this.campaignId = campaignId;
  }

  static fromRequest({ user = null, params = {} } = {}) {
    return new OpenCampaignConversationDto({
      user,
      campaignId: params?.campaignId || null,
    });
  }
}
