export class BadgeQueryGateway {
  async getMyBadgeFeed(_userId, _query = {}) {
    throw new Error('BadgeQueryGateway.getMyBadgeFeed must be implemented');
  }

  async getUserBadgeOverview(_viewerUserId, _targetUserId) {
    throw new Error('BadgeQueryGateway.getUserBadgeOverview must be implemented');
  }
}
