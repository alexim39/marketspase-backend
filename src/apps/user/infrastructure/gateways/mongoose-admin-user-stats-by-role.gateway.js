import { UserModel } from '../../models/user/index.js';
import { AdminUserStatsByRoleGateway } from '../../application/ports/admin-user-stats-by-role.gateway.js';

export class MongooseAdminUserStatsByRoleGateway extends AdminUserStatsByRoleGateway {
  constructor({ userModel = UserModel } = {}) {
    super();
    this.userModel = userModel;
  }

  async getUserStatsByRole({ role, recentSince } = {}) {
    const [
      totalUsers,
      activeUsers,
      verifiedUsers,
      deletedUsers,
      recentUsers,
      totalBalance,
      avgRating,
      referralStats,
    ] = await Promise.all([
      this.userModel.countDocuments({ role, isDeleted: false }),
      this.userModel.countDocuments({ role, isActive: true, isDeleted: false }),
      this.userModel.countDocuments({ role, isVerified: true, isDeleted: false }),
      this.userModel.countDocuments({ role, isDeleted: true }),
      this.userModel.countDocuments({
        role,
        isDeleted: false,
        createdAt: { $gte: recentSince },
      }),
      this.userModel.aggregate([
        { $match: { role, isDeleted: false } },
        {
          $project: {
            totalBalance: {
              $add: [
                { $ifNull: ['$wallets.marketer.balance', 0] },
                { $ifNull: ['$wallets.promoter.balance', 0] },
              ],
            },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$totalBalance' },
            average: { $avg: '$totalBalance' },
          },
        },
      ]),
      this.userModel.aggregate([
        { $match: { role, isDeleted: false, ratingCount: { $gt: 0 } } },
        {
          $group: {
            _id: null,
            avgRating: { $avg: '$rating' },
            totalRatings: { $sum: '$ratingCount' },
          },
        },
      ]),
      this.userModel.aggregate([
        { $match: { role, isDeleted: false } },
        {
          $group: {
            _id: null,
            totalReferrals: { $sum: '$referralInfo.totalReferrals' },
            totalEarned: { $sum: '$referralInfo.totalEarned' },
          },
        },
      ]),
    ]);

    return {
      totalUsers,
      activeUsers,
      verifiedUsers,
      deletedUsers,
      recentUsers,
      balanceData: totalBalance[0] || { total: 0, average: 0 },
      ratingData: avgRating[0] || { avgRating: 0, totalRatings: 0 },
      referralData: referralStats[0] || { totalReferrals: 0, totalEarned: 0 },
    };
  }
}
