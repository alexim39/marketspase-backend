export class PingLoginStreakSessionDto {
  constructor({ userId, sessionId = null, metadata = {} } = {}) {
    this.userId = userId;
    this.sessionId = sessionId || null;
    this.metadata = metadata && typeof metadata === 'object' ? { ...metadata } : {};
  }

  static fromRequest({ userId, body, metadata } = {}) {
    return new PingLoginStreakSessionDto({
      userId,
      sessionId: body?.sessionId || null,
      metadata: metadata || {},
    });
  }
}
