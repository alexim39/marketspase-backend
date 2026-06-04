export class GetAdminTestimonialsDto {
  constructor({ status, rating, featured, page = 1, limit = 10 }) {
    this.status = status;
    this.rating = rating;
    this.featured = featured;
    this.page = page;
    this.limit = limit;
  }

  static fromRequest({ query }) {
    return new GetAdminTestimonialsDto({
      status: query?.status,
      rating: query?.rating,
      featured: query?.featured,
      page: query?.page ?? 1,
      limit: query?.limit ?? 10,
    });
  }
}
