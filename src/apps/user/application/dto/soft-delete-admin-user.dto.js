export class SoftDeleteAdminUserDto {
  constructor({ userId = null, actorId = 'system' } = {}) {
    this.userId = userId;
    this.actorId = actorId || 'system';
  }

  static fromRequest({ params = {}, user = null } = {}) {
    return new SoftDeleteAdminUserDto({
      userId: params.id || null,
      actorId: user?._id || 'system',
    });
  }
}
