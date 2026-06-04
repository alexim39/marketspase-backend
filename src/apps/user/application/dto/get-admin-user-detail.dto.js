export class GetAdminUserDetailDto {
  constructor({ userId = null } = {}) {
    this.userId = userId;
  }

  static fromRequest({ params = {} } = {}) {
    return new GetAdminUserDetailDto({
      userId: params.id || null,
    });
  }
}
