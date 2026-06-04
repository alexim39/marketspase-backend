export class StreamAdminUsersDto {
  constructor({
    search = '',
    role = undefined,
    isActive = undefined,
    isVerified = undefined,
  } = {}) {
    this.search = search;
    this.role = role;
    this.isActive = isActive;
    this.isVerified = isVerified;
  }

  static fromRequest({ query = {} } = {}) {
    return new StreamAdminUsersDto({
      search: query.search ?? '',
      role: query.role,
      isActive: query.isActive,
      isVerified: query.isVerified,
    });
  }
}
