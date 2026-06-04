import { BadgeAdminConfigGateway } from '../../application/ports/badge-admin-config.gateway.js';
import {
  getAdminBadgeConfig,
  updateAdminBadgeConfig,
} from '../../service/badge.service.js';

export class LegacyBadgeAdminConfigGateway extends BadgeAdminConfigGateway {
  async getAdminBadgeConfig() {
    return getAdminBadgeConfig();
  }

  async updateAdminBadgeConfig(adminId, payload = {}) {
    return updateAdminBadgeConfig(adminId, payload);
  }
}
