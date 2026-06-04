export class UpdateMarketingRepStatusDto {
  constructor({ userId = null, newValue } = {}) {
    this.userId = userId;
    this.newValue = newValue;
  }

  static fromRequest({ body = {} } = {}) {
    return new UpdateMarketingRepStatusDto({
      userId: body.userId || null,
      newValue: body.newValue,
    });
  }
}
