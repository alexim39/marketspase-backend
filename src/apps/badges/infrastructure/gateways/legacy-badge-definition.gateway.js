import { BadgeDefinitionGateway } from '../../application/ports/badge-definition.gateway.js';
import {
  createBadgeDefinition,
  deleteBadgeDefinition,
  updateBadgeDefinition,
} from '../../service/badge.service.js';

export class LegacyBadgeDefinitionGateway extends BadgeDefinitionGateway {
  async createBadgeDefinition(adminId, payload = {}) {
    return createBadgeDefinition(adminId, payload);
  }

  async updateBadgeDefinition(adminId, badgeId, payload = {}) {
    return updateBadgeDefinition(adminId, badgeId, payload);
  }

  async deleteBadgeDefinition(adminId, badgeId) {
    return deleteBadgeDefinition(adminId, badgeId);
  }
}
