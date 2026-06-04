export class UpdateBadgeDefinitionDto {
  constructor({ adminId, badgeId, payload = {} } = {}) {
    this.adminId = adminId;
    this.badgeId = badgeId;
    this.payload = payload && typeof payload === 'object' ? { ...payload } : {};
  }

  static fromRequest({ adminId, badgeId, body } = {}) {
    return new UpdateBadgeDefinitionDto({
      adminId,
      badgeId,
      payload: body || {},
    });
  }
}
