export class GetMyBadgeFeedDto {
  constructor({ userId, query = {} } = {}) {
    this.userId = userId;
    this.query = query && typeof query === 'object' ? { ...query } : {};
  }

  static fromRequest({ userId, query } = {}) {
    return new GetMyBadgeFeedDto({ userId, query });
  }
}
