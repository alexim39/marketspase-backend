export class UpdateAdminBadgeConfigDto {
  constructor({ adminId, payload = {} } = {}) {
    this.adminId = adminId;
    this.payload = payload && typeof payload === 'object' ? { ...payload } : {};
  }

  static fromRequest({ adminId, body } = {}) {
    return new UpdateAdminBadgeConfigDto({
      adminId,
      payload: body || {},
    });
  }
}
