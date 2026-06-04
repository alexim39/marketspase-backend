import { GetAdminUserSummaryDto } from '../dto/get-admin-user-summary.dto.js';

const DEFAULT_SUMMARY = {
  roleCounts: {},
  totals: { total: 0, active: 0, verified: 0 },
  recent: { recentRegistrations: 0, recentActive: 0 },
  monthlyGrowth: [],
};

export class GetAdminUserSummaryUseCase {
  constructor({ adminUserSummaryGateway, now = () => new Date() } = {}) {
    if (!adminUserSummaryGateway) {
      throw new Error('adminUserSummaryGateway is required');
    }

    this.adminUserSummaryGateway = adminUserSummaryGateway;
    this.now = now;
  }

  async execute(input = new GetAdminUserSummaryDto()) {
    const _dto = input instanceof GetAdminUserSummaryDto
      ? input
      : new GetAdminUserSummaryDto(input);

    const thirtyDaysAgo = this.now();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const summary = await this.adminUserSummaryGateway.getUserSummary({ thirtyDaysAgo });

    return {
      statusCode: 200,
      body: {
        success: true,
        message: 'User summary fetched successfully',
        data: summary || DEFAULT_SUMMARY,
      },
    };
  }
}
