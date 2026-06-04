export class GetDismissedBannerMessagesDto {
  constructor({ userId = '' } = {}) {
    this.userId = userId || '';
  }

  static fromRequest({ params = {} } = {}) {
    return new GetDismissedBannerMessagesDto({
      userId: params.userId,
    });
  }
}
