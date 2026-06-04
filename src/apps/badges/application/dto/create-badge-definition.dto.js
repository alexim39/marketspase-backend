export class CreateBadgeDefinitionDto {
  constructor({ adminId, payload = {} } = {}) {
    this.adminId = adminId;
    this.payload = payload && typeof payload === 'object' ? { ...payload } : {};
  }

  static fromRequest({ adminId, body } = {}) {
    return new CreateBadgeDefinitionDto({
      adminId,
      payload: body || {},
    });
  }
}
