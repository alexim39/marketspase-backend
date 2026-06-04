export class SwitchUserRoleDto {
  constructor({ userId = null, role = null } = {}) {
    this.userId = userId;
    this.role = role;
  }

  static fromRequest({ userId = null, body = {} } = {}) {
    return new SwitchUserRoleDto({
      userId,
      role: body?.role || null,
    });
  }
}
