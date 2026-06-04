export class CheckPromoEligibilityDto {
  constructor({ promoId = null, userId = null } = {}) {
    this.promoId = promoId;
    this.userId = userId;
  }

  static fromRequest({ params = {} } = {}) {
    return new CheckPromoEligibilityDto({
      promoId: params.promoId || null,
      userId: params.userId || null,
    });
  }
}
