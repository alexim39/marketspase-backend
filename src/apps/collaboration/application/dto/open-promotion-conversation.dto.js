export class OpenPromotionConversationDto {
  constructor({ user = null, promotionId = null } = {}) {
    this.user = user;
    this.promotionId = promotionId;
  }

  static fromRequest({ user = null, params = {} } = {}) {
    return new OpenPromotionConversationDto({
      user,
      promotionId: params?.promotionId || null,
    });
  }
}
