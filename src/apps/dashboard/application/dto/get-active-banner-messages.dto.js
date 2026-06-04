export class GetActiveBannerMessagesDto {
  constructor({ user = null, now = new Date() } = {}) {
    this.user = user || null;
    this.now = now instanceof Date ? now : new Date(now);
  }

  static fromRequest({ user } = {}) {
    return new GetActiveBannerMessagesDto({ user: user || null });
  }
}
