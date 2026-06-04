import { GamificationAdminConfigGateway } from '../../application/ports/gamification-admin-config.gateway.js';
import {
  getAdminGamificationConfig,
  updateAdminGamificationConfig,
} from '../../service/gamification.service.js';

export class LegacyGamificationAdminConfigGateway extends GamificationAdminConfigGateway {
  async getAdminGamificationConfig() {
    return getAdminGamificationConfig();
  }

  async updateAdminGamificationConfig(adminId, payload = {}) {
    return updateAdminGamificationConfig(adminId, payload);
  }
}
