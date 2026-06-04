import { UserModel } from '../../models/user/index.js';
import { AdminRoleStatisticsGateway } from '../../application/ports/admin-role-statistics.gateway.js';

export class MongooseAdminRoleStatisticsGateway extends AdminRoleStatisticsGateway {
  constructor({ userModel = UserModel } = {}) {
    super();
    this.userModel = userModel;
  }

  async getRoleStatistics({ role, thirtyDaysAgo } = {}) {
    const roleStats = await this.userModel.aggregate([
      {
        $match: {
          role,
          isDeleted: false,
        },
      },
      {
        $facet: {
          counts: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                active: { $sum: { $cond: ['$isActive', 1, 0] } },
                verified: { $sum: { $cond: ['$isVerified', 1, 0] } },
                recent: {
                  $sum: {
                    $cond: [
                      { $gte: ['$createdAt', thirtyDaysAgo] },
                      1,
                      0,
                    ],
                  },
                },
              },
            },
          ],
          financial: [
            {
              $group: {
                _id: null,
                totalBalance: {
                  $sum: {
                    $cond: [
                      { $eq: [role, 'marketer'] },
                      '$wallets.marketer.balance',
                      '$wallets.promoter.balance',
                    ],
                  },
                },
                count: { $sum: 1 },
              },
            },
            {
              $project: {
                totalBalance: { $ifNull: ['$totalBalance', 0] },
                averageBalance: {
                  $cond: [
                    { $eq: ['$count', 0] },
                    0,
                    { $divide: ['$totalBalance', '$count'] },
                  ],
                },
                currency: 'NGN',
              },
            },
          ],
          engagement: [
            {
              $group: {
                _id: null,
                averageRating: { $avg: '$rating' },
                totalRatings: { $sum: '$ratingCount' },
                ratedUsers: {
                  $sum: {
                    $cond: [
                      { $gt: ['$ratingCount', 0] },
                      1,
                      0,
                    ],
                  },
                },
                totalUsers: { $sum: 1 },
              },
            },
            {
              $project: {
                averageRating: { $ifNull: ['$averageRating', 0] },
                totalRatings: { $ifNull: ['$totalRatings', 0] },
                percentageRated: {
                  $cond: [
                    { $eq: ['$totalUsers', 0] },
                    0,
                    { $multiply: [{ $divide: ['$ratedUsers', '$totalUsers'] }, 100] },
                  ],
                },
              },
            },
          ],
          activity: [
            {
              $group: {
                _id: null,
                totalReferrals: { $sum: '$referralInfo.totalReferrals' },
                totalEarned: { $sum: '$referralInfo.totalEarned' },
              },
            },
            {
              $project: {
                totalReferrals: { $ifNull: ['$totalReferrals', 0] },
                totalEarned: { $ifNull: ['$totalEarned', 0] },
              },
            },
          ],
        },
      },
      {
        $project: {
          role,
          counts: { $arrayElemAt: ['$counts', 0] },
          financial: { $arrayElemAt: ['$financial', 0] },
          engagement: { $arrayElemAt: ['$engagement', 0] },
          activity: { $arrayElemAt: ['$activity', 0] },
        },
      },
    ]);

    return roleStats[0] || null;
  }
}
