export class UpdateUsernameDto {
  constructor({ userId = null, body = {} } = {}) {
    this.userId = userId;
    this.username = body?.username;
  }

  static fromRequest({ userId = null, body = {} } = {}) {
    return new UpdateUsernameDto({
      userId,
      body,
    });
  }
}
