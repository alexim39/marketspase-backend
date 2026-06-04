export class CreateBannerMessageDto {
  constructor({ data = {} } = {}) {
    this.data = data && typeof data === 'object' ? { ...data } : {};
  }

  static fromRequest({ body = {} } = {}) {
    return new CreateBannerMessageDto({ data: body || {} });
  }
}
