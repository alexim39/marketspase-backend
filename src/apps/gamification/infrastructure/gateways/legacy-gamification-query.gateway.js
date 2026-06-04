import { GamificationQueryGateway } from '../../application/ports/gamification-query.gateway.js';
import {
  getGamificationDashboard,
  getGamificationFeed,
} from '../../service/gamification.service.js';

export class LegacyGamificationQueryGateway extends GamificationQueryGateway {
  async getGamificationDashboard(userId) {
    return getGamificationDashboard(userId);
  }

  async getGamificationFeed(userId) {
    return getGamificationFeed(userId);
  }
}
