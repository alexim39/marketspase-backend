export class UpdatePublicIdentityDto {
  constructor({ userId = null, body = {} } = {}) {
    this.userId = userId;
    this.body = body || {};
  }

  static fromRequest({ userId = null, body = {} } = {}) {
    return new UpdatePublicIdentityDto({
      userId,
      body,
    });
  }
}
