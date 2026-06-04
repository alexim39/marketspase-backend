export class BadgeDefinitionGateway {
  async createBadgeDefinition(_adminId, _payload = {}) {
    throw new Error('BadgeDefinitionGateway.createBadgeDefinition must be implemented');
  }

  async updateBadgeDefinition(_adminId, _badgeId, _payload = {}) {
    throw new Error('BadgeDefinitionGateway.updateBadgeDefinition must be implemented');
  }

  async deleteBadgeDefinition(_adminId, _badgeId) {
    throw new Error('BadgeDefinitionGateway.deleteBadgeDefinition must be implemented');
  }
}
