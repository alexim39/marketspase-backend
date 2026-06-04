export class UpdatePersonalProfileDto {
  constructor({ userId = null, body = {} } = {}) {
    this.userId = userId;
    this.body = body || {};
  }

  static fromRequest({ userId = null, body = {} } = {}) {
    return new UpdatePersonalProfileDto({
      userId,
      body,
    });
  }
}
