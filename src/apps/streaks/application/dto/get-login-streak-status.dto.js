export class GetLoginStreakStatusDto {
  constructor({ userId } = {}) {
    this.userId = userId;
  }

  static fromRequest({ userId } = {}) {
    return new GetLoginStreakStatusDto({ userId });
  }
}
