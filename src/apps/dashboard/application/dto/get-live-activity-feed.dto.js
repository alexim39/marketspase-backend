export class GetLiveActivityFeedDto {
  constructor({ query = {} } = {}) {
    this.query = query && typeof query === 'object' ? { ...query } : {};
  }

  static fromRequest({ query } = {}) {
    return new GetLiveActivityFeedDto({ query: query || {} });
  }
}
