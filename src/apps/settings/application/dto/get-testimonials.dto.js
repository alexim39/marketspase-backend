export class GetTestimonialsDto {
  constructor({ status = "approved", limit = 10, page = 1 }) {
    this.status = status;
    this.limit = limit;
    this.page = page;
  }

  static fromRequest({ query }) {
    return new GetTestimonialsDto({
      status: query?.status ?? "approved",
      limit: query?.limit ?? 10,
      page: query?.page ?? 1,
    });
  }
}
