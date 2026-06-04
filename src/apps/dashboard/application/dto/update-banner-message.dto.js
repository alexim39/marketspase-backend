export class UpdateBannerMessageDto {
  constructor({ id = '', data = {} } = {}) {
    this.id = id || '';
    this.data = data && typeof data === 'object' ? { ...data } : {};
  }

  static fromRequest({ params = {}, body = {} } = {}) {
    return new UpdateBannerMessageDto({
      id: params.id,
      data: body || {},
    });
  }
}
