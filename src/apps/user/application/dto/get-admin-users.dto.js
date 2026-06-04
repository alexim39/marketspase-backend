export class GetAdminUsersDto {
  constructor({
    page = 1,
    limit = 50,
    search = '',
    sort = '-createdAt',
    role = undefined,
    isActive = undefined,
    isVerified = undefined,
  } = {}) {
    this.page = page;
    this.limit = limit;
    this.search = search;
    this.sort = sort;
    this.role = role;
    this.isActive = isActive;
    this.isVerified = isVerified;
  }

  static fromRequest({ query = {} } = {}) {
    return new GetAdminUsersDto({
      page: query.page ?? 1,
      limit: query.limit ?? 50,
      search: query.search ?? '',
      sort: query.sort ?? '-createdAt',
      role: query.role,
      isActive: query.isActive,
      isVerified: query.isVerified,
    });
  }
}
