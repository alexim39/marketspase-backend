export class GetMyPromoClaimsDto {
  constructor({ userId } = {}) {
    this.userId = userId;
  }

  static fromRequest({ user } = {}) {
    return new GetMyPromoClaimsDto({
      userId: user._id,
    });
  }
}
