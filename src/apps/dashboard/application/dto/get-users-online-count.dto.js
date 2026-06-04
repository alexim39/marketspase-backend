export class GetUsersOnlineCountDto {
  constructor({ params = {} } = {}) {
    this.params = params && typeof params === 'object' ? { ...params } : {};
  }

  static fromRequest({ params } = {}) {
    return new GetUsersOnlineCountDto({ params: params || {} });
  }
}
