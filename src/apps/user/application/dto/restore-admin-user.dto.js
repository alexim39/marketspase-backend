export class RestoreAdminUserDto {
  constructor({ userId = null, actorId = 'system' } = {}) {
    this.userId = userId;
    this.actorId = actorId || 'system';
  }

  static fromRequest({ params = {}, user = null } = {}) {
    return new RestoreAdminUserDto({
      userId: params.id || null,
      actorId: user?._id || 'system',
    });
  }
}
