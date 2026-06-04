export class GetReviewEligibilityDto {
  constructor({ reviewerId = null, revieweeId = '', promotionId = null } = {}) {
    this.reviewerId = reviewerId || null;
    this.revieweeId = revieweeId || '';
    this.promotionId = promotionId || null;
  }

  static fromRequest({ user = null, params = {}, query = {} } = {}) {
    return new GetReviewEligibilityDto({
      reviewerId: user?._id,
      revieweeId: params.targetUserId,
      promotionId: query.promotionId || null,
    });
  }
}
