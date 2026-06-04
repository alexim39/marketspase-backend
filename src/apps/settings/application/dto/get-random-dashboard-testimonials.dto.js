export class GetRandomDashboardTestimonialsDto {
  constructor({ count }) {
    this.count = count;
  }

  static fromRequest({ query }) {
    return new GetRandomDashboardTestimonialsDto({
      count: query?.count,
    });
  }
}
