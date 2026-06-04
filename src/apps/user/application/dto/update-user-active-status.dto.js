export class UpdateUserActiveStatusDto {
  constructor({ userId = null, isActive, actorId = 'system' } = {}) {
    this.userId = userId;
    this.isActive = isActive;
    this.actorId = actorId || 'system';
  }

  static fromRequest({ params = {}, body = {}, user = null } = {}) {
    return new UpdateUserActiveStatusDto({
      userId: params.id || null,
      isActive: body.isActive,
      actorId: user?._id || 'system',
    });
  }
}
