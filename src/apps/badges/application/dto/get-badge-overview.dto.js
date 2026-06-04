export class GetBadgeOverviewDto {
  constructor({ viewerUserId, targetUserId } = {}) {
    this.viewerUserId = viewerUserId;
    this.targetUserId = targetUserId;
  }

  static fromRequest({ viewerUserId, targetUserId } = {}) {
    return new GetBadgeOverviewDto({ viewerUserId, targetUserId });
  }
}
