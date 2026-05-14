// src/app/metrics/repository/metrics.repository.js
import { UserModel } from '../../user/models/user/index.js';

export class MetricsRepository {
  async getAppMetrics() {
    const [
      totalUsers,
      roleBreakdown,
      activeUsers,
      verifiedUsers,
      referralStats
    ] = await Promise.all([
      UserModel.countDocuments({ isDeleted: false }),

      UserModel.aggregate([
        { $match: { isDeleted: false } },
        {
          $group: {
            _id: '$role',
            count: { $sum: 1 }
          }
        }
      ]),

      UserModel.countDocuments({
        isDeleted: false,
        isActive: true,
        lastSeenAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
      }),

      UserModel.countDocuments({ isDeleted: false, isVerified: true }),

      UserModel.aggregate([
        { $match: { isDeleted: false } },
        {
          $group: {
            _id: null,
            totalReferrals: { $sum: '$referralInfo.totalReferrals' },
            totalEarned: { $sum: '$referralInfo.totalEarned' }
          }
        }
      ])
    ]);

    const roles = roleBreakdown.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    const total = totalUsers || 0;

    return {
      totalUsers: total,
      totalMarketers: roles.marketer || 0,
      totalPromoters: roles.promoter || 0,
      totalAdmins: roles.admin || 0,
      totalMarketingReps: roles.marketing_rep || 0,

      totalActiveUsers: activeUsers,
      totalVerifiedUsers: verifiedUsers,

      totalReferrals: referralStats[0]?.totalReferrals || 0,
      totalEarnedFromReferrals: referralStats[0]?.totalEarned || 0,

      engagementRate: total > 0 ? Math.round((activeUsers / total) * 100) : 0,
      verificationRate: total > 0 ? Math.round((verifiedUsers / total) * 100) : 0,

      lastUpdated: new Date().toISOString()
    };
  }
}

export const metricsRepository = new MetricsRepository();