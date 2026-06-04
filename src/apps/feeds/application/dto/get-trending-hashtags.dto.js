export class GetTrendingHashtagsDto {
  constructor({ limit = 20 } = {}) {
    this.limit = Number.isFinite(Number(limit)) ? Number(limit) : 20;
  }

  static fromRequest() {
    return new GetTrendingHashtagsDto({
      limit: 20,
    });
  }
}
