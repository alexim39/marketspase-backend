import { BadgeQueryGateway } from '../../application/ports/badge-query.gateway.js';
import {
  getMyBadgeFeed,
  getUserBadgeOverview,
} from '../../service/badge.service.js';

export class LegacyBadgeQueryGateway extends BadgeQueryGateway {
  async getMyBadgeFeed(userId, query = {}) {
    return getMyBadgeFeed(userId, query);
  }

  async getUserBadgeOverview(viewerUserId, targetUserId) {
    return getUserBadgeOverview(viewerUserId, targetUserId);
  }
}
