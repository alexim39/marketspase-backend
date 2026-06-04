export class DismissBannerMessageDto {
  constructor({ notificationId = '', userId = '' } = {}) {
    this.notificationId = notificationId || '';
    this.userId = userId || '';
  }

  static fromRequest({ params = {}, body = {} } = {}) {
    return new DismissBannerMessageDto({
      notificationId: params.notificationId,
      userId: body.userId,
    });
  }
}
