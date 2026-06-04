export class FlagCollaborationReviewDto {
  constructor({ reviewId = '', userId = null, body = {} } = {}) {
    this.reviewId = reviewId || '';
    this.userId = userId || null;
    this.reason = String(body?.reason || '').trim();
    this.details = String(body?.details || '').trim();
  }

  static fromRequest({ user = null, params = {}, body = {} } = {}) {
    return new FlagCollaborationReviewDto({
      reviewId: params.reviewId,
      userId: user?._id,
      body: body || {},
    });
  }
}
