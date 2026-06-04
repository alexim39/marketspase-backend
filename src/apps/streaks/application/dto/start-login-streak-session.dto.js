export class StartLoginStreakSessionDto {
  constructor({ userId, metadata = {} } = {}) {
    this.userId = userId;
    this.metadata = metadata && typeof metadata === 'object' ? { ...metadata } : {};
  }

  static fromRequest({ userId, metadata } = {}) {
    return new StartLoginStreakSessionDto({
      userId,
      metadata: metadata || {},
    });
  }
}
