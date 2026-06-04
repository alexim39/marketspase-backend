export class UpdateProfessionalProfileDto {
  constructor({ userId = null, body = {} } = {}) {
    this.userId = userId;
    this.body = body || {};
  }

  static fromRequest({ userId = null, body = {} } = {}) {
    return new UpdateProfessionalProfileDto({
      userId,
      body,
    });
  }
}
