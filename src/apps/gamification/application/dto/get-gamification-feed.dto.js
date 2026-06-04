export class GetGamificationFeedDto {
  constructor({ userId } = {}) {
    this.userId = userId;
  }

  static fromRequest({ userId } = {}) {
    return new GetGamificationFeedDto({ userId });
  }
}
