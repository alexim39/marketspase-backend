import { UserModel } from '../../models/user/index.js';
import { AdminUserSummaryGateway } from '../../application/ports/admin-user-summary.gateway.js';

export class MongooseAdminUserSummaryGateway extends AdminUserSummaryGateway {
  constructor({ userModel = UserModel } = {}) {
    super();
    this.userModel = userModel;
  }

  async getUserSummary({ thirtyDaysAgo } = {}) {
    const summary = await this.userModel.aggregate([
      {
        $match: { isDeleted: false },
      },
      {
        $facet: {
          roleCounts: [
            {
              $group: {
                _id: '$role',
                count: { $sum: 1 },
              },
            },
          ],
          statusCounts: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                active: { $sum: { $cond: ['$isActive', 1, 0] } },
                verified: { $sum: { $cond: ['$isVerified', 1, 0] } },
              },
            },
          ],
          recentStats: [
            {
              $match: {
                createdAt: { $gte: thirtyDaysAgo },
              },
            },
            {
              $group: {
                _id: null,
                recentRegistrations: { $sum: 1 },
                recentActive: { $sum: { $cond: ['$isActive', 1, 0] } },
              },
            },
          ],
          monthlyGrowth: [
            {
              $group: {
                _id: {
                  year: { $year: '$createdAt' },
                  month: { $month: '$createdAt' },
                },
                count: { $sum: 1 },
              },
            },
            { $sort: { '_id.year': -1, '_id.month': -1 } },
            { $limit: 6 },
          ],
        },
      },
      {
        $project: {
          roleCounts: {
            $arrayToObject: {
              $map: {
                input: '$roleCounts',
                as: 'role',
                in: { k: '$$role._id', v: '$$role.count' },
              },
            },
          },
          totals: { $arrayElemAt: ['$statusCounts', 0] },
          recent: { $arrayElemAt: ['$recentStats', 0] },
          monthlyGrowth: '$monthlyGrowth',
        },
      },
    ]);

    return summary[0] || null;
  }
}
