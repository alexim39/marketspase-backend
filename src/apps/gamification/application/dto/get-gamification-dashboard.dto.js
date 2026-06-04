export class GetGamificationDashboardDto {
  constructor({ userId } = {}) {
    this.userId = userId;
  }

  static fromRequest({ userId } = {}) {
    return new GetGamificationDashboardDto({ userId });
  }
}
