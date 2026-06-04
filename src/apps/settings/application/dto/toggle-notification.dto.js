export class ToggleNotificationDto {
  constructor({ userId, state }) {
    this.userId = userId;
    this.state = state;
  }

  static fromRequest({ body }) {
    return new ToggleNotificationDto({
      userId: body?.userId,
      state: body?.state,
    });
  }
}
