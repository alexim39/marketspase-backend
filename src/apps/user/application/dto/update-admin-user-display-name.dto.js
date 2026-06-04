export class UpdateAdminUserDisplayNameDto {
  constructor({
    userId = null,
    displayName,
    actorId = 'system',
    ipAddress = null,
    userAgent = null,
  } = {}) {
    this.userId = userId;
    this.displayName = displayName;
    this.actorId = actorId || 'system';
    this.ipAddress = ipAddress;
    this.userAgent = userAgent;
  }

  static fromRequest({ params = {}, body = {}, user = null, ip = null, getHeader = null } = {}) {
    return new UpdateAdminUserDisplayNameDto({
      userId: params.userId || params.id || null,
      displayName: body.displayName,
      actorId: user?._id || 'system',
      ipAddress: ip,
      userAgent: typeof getHeader === 'function' ? getHeader('user-agent') : null,
    });
  }
}
