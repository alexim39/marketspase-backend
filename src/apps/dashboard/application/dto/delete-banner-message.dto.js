export class DeleteBannerMessageDto {
  constructor({ id = '' } = {}) {
    this.id = id || '';
  }

  static fromRequest({ params = {} } = {}) {
    return new DeleteBannerMessageDto({
      id: params.id,
    });
  }
}
