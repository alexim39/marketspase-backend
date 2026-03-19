import { TARGET_AUDIENCE, MESSAGE_PRIORITY } from "./banner-message.constants.js";

export const setupBannerMessageStatics = (schema) => {
  // Find active banners for a user
  schema.statics.findActiveForUser = async function(user) {
    const now = new Date();
    const query = {
      isActive: true,
      isDeleted: false,
      startDate: { $lte: now },
      endDate: { $gte: now },
      $or: [
        { targetAudience: TARGET_AUDIENCE.ALL }
      ]
    };

    // Add user-specific targeting
    if (user) {
      if (user.createdAt) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        if (user.createdAt > thirtyDaysAgo) {
          query.$or.push({ targetAudience: TARGET_AUDIENCE.NEW_USERS });
        } else {
          query.$or.push({ targetAudience: TARGET_AUDIENCE.EXISTING_USERS });
        }
      }

      // Check for specific user groups
      if (user.groups && user.groups.length > 0) {
        query.$or.push({
          targetAudience: TARGET_AUDIENCE.SPECIFIC_GROUP,
          specificUserGroups: { $in: user.groups }
        });
      }
    }

    return this.find(query)
      .sort({ priority: -1, createdAt: -1 })
      .lean();
  };

  // Get banner statistics
  schema.statics.getStats = async function() {
    const now = new Date();
    
    const stats = await this.aggregate([
      {
        $facet: {
          byStatus: [
            {
              $group: {
                _id: {
                  $cond: [
                    { $eq: ['$isDeleted', true] }, 'DELETED',
                    {
                      $cond: [
                        { $eq: ['$isActive', false] }, 'INACTIVE',
                        {
                          $cond: [
                            { $lt: ['$startDate', now] }, 'SCHEDULED',
                            {
                              $cond: [
                                { $gt: ['$endDate', now] }, 'ACTIVE',
                                'EXPIRED'
                              ]
                            }
                          ]
                        }
                      ]
                    }
                  ]
                },
                count: { $sum: 1 }
              }
            }
          ],
          byType: [
            {
              $group: {
                _id: '$type',
                count: { $sum: 1 }
              }
            }
          ],
          byPriority: [
            {
              $group: {
                _id: '$priority',
                count: { $sum: 1 }
              }
            }
          ],
          totals: [
            {
              $group: {
                _id: null,
                totalViews: { $sum: '$viewCount' },
                totalDismissals: { $sum: '$dismissCount' },
                totalClicks: { $sum: '$clickCount' },
                avgViews: { $avg: '$viewCount' },
                avgDismissals: { $avg: '$dismissCount' },
                avgClicks: { $avg: '$clickCount' }
              }
            }
          ]
        }
      }
    ]);

    return stats[0];
  };

  // Find banners needing attention
  schema.statics.findNeedingAttention = async function() {
    const now = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    return this.find({
      isActive: true,
      isDeleted: false,
      $or: [
        // Banners expiring soon
        {
          endDate: { $lte: sevenDaysFromNow, $gte: now }
        },
        // Banners that should have started but haven't
        {
          startDate: { $lte: now },
          status: 'scheduled'
        }
      ]
    }).sort({ priority: -1 });
  };

  // Get banners by priority
  schema.statics.getByPriority = function(priority = MESSAGE_PRIORITY.HIGH) {
    return this.find({
      priority,
      isActive: true,
      isDeleted: false
    }).sort({ createdAt: -1 });
  };

  // Bulk update banner status
  schema.statics.bulkUpdateStatus = async function(bannerIds, isActive, updatedBy) {
    return this.updateMany(
      { _id: { $in: bannerIds } },
      {
        $set: {
          isActive,
          updatedAt: new Date()
        },
        $push: {
          metadata: {
            statusChangedAt: new Date(),
            statusChangedBy: updatedBy,
            newStatus: isActive ? 'activated' : 'deactivated'
          }
        }
      }
    );
  };

  // Get banners by date range
  schema.statics.getByDateRange = function(startDate, endDate) {
    return this.find({
      $or: [
        {
          startDate: { $lte: endDate },
          endDate: { $gte: startDate }
        }
      ],
      isDeleted: false
    }).sort({ priority: -1, startDate: 1 });
  };

  // Get banner performance report
  schema.statics.getPerformanceReport = async function(days = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return this.aggregate([
      {
        $match: {
          createdAt: { $gte: cutoffDate },
          isDeleted: false
        }
      },
      {
        $project: {
          title: 1,
          type: 1,
          priority: 1,
          viewCount: 1,
          dismissCount: 1,
          clickCount: 1,
          engagementRate: {
            $cond: [
              { $gt: ['$viewCount', 0] },
              { $multiply: [{ $divide: ['$clickCount', '$viewCount'] }, 100] },
              0
            ]
          },
          dismissRate: {
            $cond: [
              { $gt: ['$viewCount', 0] },
              { $multiply: [{ $divide: ['$dismissCount', '$viewCount'] }, 100] },
              0
            ]
          }
        }
      },
      { $sort: { engagementRate: -1 } }
    ]);
  };
};