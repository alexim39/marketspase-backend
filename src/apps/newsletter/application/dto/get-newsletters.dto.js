export class GetNewslettersDto {
  constructor(query = {}) {
    this.status = query.status;
    this.search = query.search;
    this.page = query.page ?? 1;
    this.limit = query.limit ?? 10;
  }

  static fromRequest({ query }) {
    return new GetNewslettersDto(query);
  }
}
