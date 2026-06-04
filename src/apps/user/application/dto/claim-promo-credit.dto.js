export class ClaimPromoCreditDto {
  constructor({ promoId = null, userId = null } = {}) {
    this.promoId = promoId;
    this.userId = userId;
  }

  static fromRequest({ body = {} } = {}) {
    return new ClaimPromoCreditDto({
      promoId: body.promoId || null,
      userId: body.userId || null,
    });
  }
}
