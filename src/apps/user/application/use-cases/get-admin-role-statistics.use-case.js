import { GetAdminRoleStatisticsDto } from '../dto/get-admin-role-statistics.dto.js';

const VALID_ROLES = new Set(['marketer', 'promoter', 'admin']);

const defaultStatsForRole = (role) => ({
  role,
  counts: {
    total: 0,
    active: 0,
    verified: 0,
    recent: 0,
  },
  financial: {
    totalBalance: 0,
    averageBalance: 0,
    currency: 'NGN',
  },
  engagement: {
    averageRating: 0,
    totalRatings: 0,
    percentageRated: 0,
  },
  activity: {
    totalReferrals: 0,
    totalEarned: 0,
  },
});

export class GetAdminRoleStatisticsUseCase {
  constructor({ adminRoleStatisticsGateway, now = () => new Date() } = {}) {
    if (!adminRoleStatisticsGateway) {
      throw new Error('adminRoleStatisticsGateway is required');
    }

    this.adminRoleStatisticsGateway = adminRoleStatisticsGateway;
    this.now = now;
  }

  async execute(input) {
    const dto = input instanceof GetAdminRoleStatisticsDto
      ? input
      : new GetAdminRoleStatisticsDto(input);

    if (!VALID_ROLES.has(dto.role)) {
      return {
        statusCode: 400,
        body: {
          success: false,
          message: 'Invalid role. Must be one of: marketer, promoter, admin',
        },
      };
    }

    const thirtyDaysAgo = this.now();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const stats = await this.adminRoleStatisticsGateway.getRoleStatistics({
      role: dto.role,
      thirtyDaysAgo,
    }) || defaultStatsForRole(dto.role);

    if (stats.counts) {
      stats.counts.inactive = stats.counts.total - stats.counts.active;
      stats.counts.unverified = stats.counts.total - stats.counts.verified;
      stats.counts.deleted = 0;
    }

    return {
      statusCode: 200,
      body: {
        success: true,
        message: `${dto.role} statistics fetched successfully`,
        data: stats,
      },
    };
  }
}
