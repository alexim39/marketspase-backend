export class UpdateAdminGamificationConfigDto {
  constructor({ adminId, payload = {} } = {}) {
    this.adminId = adminId;
    this.payload = payload && typeof payload === 'object' ? { ...payload } : {};
  }

  static fromRequest({ adminId, body } = {}) {
    return new UpdateAdminGamificationConfigDto({
      adminId,
      payload: body || {},
    });
  }
}
