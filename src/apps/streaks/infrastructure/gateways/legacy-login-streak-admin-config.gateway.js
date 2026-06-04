import { LoginStreakAdminConfigGateway } from '../../application/ports/login-streak-admin-config.gateway.js';
import {
  getAdminLoginStreakConfig,
  updateAdminLoginStreakConfig,
} from '../../service/login-streak.service.js';

export class LegacyLoginStreakAdminConfigGateway extends LoginStreakAdminConfigGateway {
  async getAdminLoginStreakConfig() {
    return getAdminLoginStreakConfig();
  }

  async updateAdminLoginStreakConfig(adminId, payload = {}) {
    return updateAdminLoginStreakConfig(adminId, payload);
  }
}
