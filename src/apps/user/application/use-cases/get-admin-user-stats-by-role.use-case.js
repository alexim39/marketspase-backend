import { GetAdminUserStatsByRoleDto } from '../dto/get-admin-user-stats-by-role.dto.js';

const VALID_ROLES = new Set(['marketer', 'promoter', 'admin']);

export class GetAdminUserStatsByRoleUseCase {
  constructor({ adminUserStatsByRoleGateway, now = () => new Date() } = {}) {
    if (!adminUserStatsByRoleGateway) {
      throw new Error('adminUserStatsByRoleGateway is required');
    }

    this.adminUserStatsByRoleGateway = adminUserStatsByRoleGateway;
    this.now = now;
  }

  async execute(input) {
    const dto = input instanceof GetAdminUserStatsByRoleDto
      ? input
      : new GetAdminUserStatsByRoleDto(input);

    if (!VALID_ROLES.has(dto.role)) {
      return {
        statusCode: 400,
        body: {
          success: false,
          message: 'Invalid role. Must be one of: marketer, promoter, admin',
        },
      };
    }

    const recentSince = new Date(this.now().getTime() - 30 * 24 * 60 * 60 * 1000);
    const stats = await this.adminUserStatsByRoleGateway.getUserStatsByRole({
      role: dto.role,
      recentSince,
    });

    const balanceData = stats.balanceData || { total: 0, average: 0 };
    const ratingData = stats.ratingData || { avgRating: 0, totalRatings: 0 };
    const referralData = stats.referralData || { totalReferrals: 0, totalEarned: 0 };

    return {
      statusCode: 200,
      body: {
        success: true,
        data: {
          role: dto.role,
          counts: {
            total: stats.totalUsers,
            active: stats.activeUsers,
            inactive: stats.totalUsers - stats.activeUsers,
            verified: stats.verifiedUsers,
            unverified: stats.totalUsers - stats.verifiedUsers,
            deleted: stats.deletedUsers,
            recent: stats.recentUsers,
          },
          financial: {
            totalBalance: balanceData.total,
            averageBalance: balanceData.average,
            currency: 'NGN',
          },
          engagement: {
            averageRating: ratingData.avgRating,
            totalRatings: ratingData.totalRatings,
            percentageRated: stats.totalUsers > 0 ? (ratingData.totalRatings / stats.totalUsers) * 100 : 0,
          },
          activity: {
            totalReferrals: referralData,
          },
        },
      },
    };
  }
}
