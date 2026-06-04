export class GetAdminRoleStatisticsDto {
  constructor({ role = null } = {}) {
    this.role = role;
  }

  static fromRequest({ params = {} } = {}) {
    return new GetAdminRoleStatisticsDto({
      role: params.role || null,
    });
  }
}
