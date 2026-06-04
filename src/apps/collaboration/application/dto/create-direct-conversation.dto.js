export class CreateDirectConversationDto {
  constructor({ user = null, targetUserId = null, campaignId = null, promotionId = null } = {}) {
    this.user = user;
    this.targetUserId = targetUserId;
    this.campaignId = campaignId;
    this.promotionId = promotionId;
  }

  static fromRequest({ user = null, body = {} } = {}) {
    return new CreateDirectConversationDto({
      user,
      targetUserId: body?.targetUserId || null,
      campaignId: body?.campaignId || null,
      promotionId: body?.promotionId || null,
    });
  }
}
