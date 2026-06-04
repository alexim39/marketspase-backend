export class GetAdminUsersByRoleDto {
  constructor({
    role = null,
    page = 1,
    limit = 50,
    search = '',
    sort = '-createdAt',
    isActive = undefined,
    isVerified = undefined,
  } = {}) {
    this.role = role;
    this.page = page;
    this.limit = limit;
    this.search = search;
    this.sort = sort;
    this.isActive = isActive;
    this.isVerified = isVerified;
  }

  static fromRequest({ params = {}, query = {} } = {}) {
    return new GetAdminUsersByRoleDto({
      role: params.role || null,
      page: query.page ?? 1,
      limit: query.limit ?? 50,
      search: query.search ?? '',
      sort: query.sort ?? '-createdAt',
      isActive: query.isActive,
      isVerified: query.isVerified,
    });
  }
}
