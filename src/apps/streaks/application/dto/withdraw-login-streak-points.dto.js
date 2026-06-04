export class WithdrawLoginStreakPointsDto {
  constructor({ userId, payload = {} } = {}) {
    this.userId = userId;
    this.payload = payload && typeof payload === 'object' ? { ...payload } : {};
  }

  static fromRequest({ userId, body } = {}) {
    return new WithdrawLoginStreakPointsDto({
      userId,
      payload: body || {},
    });
  }
}
