export class CreateCollaborationReviewDto {
  constructor({ reviewerId = null, body = {} } = {}) {
    this.reviewerId = reviewerId || null;
    this.revieweeId = body?.revieweeId;
    this.promotionId = body?.promotionId;
    this.rating = Number(body?.rating);
    this.title = String(body?.title || '').trim();
    this.comment = String(body?.comment || '').trim();
  }

  static fromRequest({ user = null, body = {} } = {}) {
    return new CreateCollaborationReviewDto({
      reviewerId: user?._id,
      body: body || {},
    });
  }
}
