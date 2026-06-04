export class ModerateCollaborationReviewDto {
  constructor({ reviewId = '', adminId = null, body = {} } = {}) {
    this.reviewId = reviewId || '';
    this.adminId = adminId || null;
    this.action = String(body?.action || '').trim();
    this.note = String(body?.note || '').trim();
    this.response = String(body?.response || '').trim();
  }

  static fromRequest({ user = null, params = {}, body = {} } = {}) {
    return new ModerateCollaborationReviewDto({
      reviewId: params.reviewId,
      adminId: user?._id,
      body: body || {},
    });
  }
}
