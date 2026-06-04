export class GetAdminUserStatsByRoleDto {
  constructor({ role = null } = {}) {
    this.role = role;
  }

  static fromRequest({ params = {} } = {}) {
    return new GetAdminUserStatsByRoleDto({
      role: params.role || null,
    });
  }
}
