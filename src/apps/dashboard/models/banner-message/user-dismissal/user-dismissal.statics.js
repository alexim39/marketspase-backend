export const setupUserDismissalStatics = (schema) => {
  // Find or create dismissal record for user
  schema.statics.findOrCreate = async function(userId) {
    let record = await this.findOne({ userId });
    
    if (!record) {
      record = await this.create({ 
        userId,
        dismissedNotifications: [],
        dismissedAt: {}
      });
    }
    
    return record;
  };

  // Get dismissal statistics
  schema.statics.getStats = async function() {
    const stats = await this.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          totalDismissals: { $sum: '$dismissalCount' },
          avgDismissalsPerUser: { $avg: '$dismissalCount' },
          usersWithDismissals: {
            $sum: { $cond: [{ $gt: ['$dismissalCount', 0] }, 1, 0] }
          }
        }
      }
    ]);

    const mostDismissedBanners = await this.aggregate([
      { $unwind: '$dismissedNotifications' },
      { $group: {
        _id: '$dismissedNotifications',
        count: { $sum: 1 }
      }},
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    return {
      ...(stats[0] || {
        totalUsers: 0,
        totalDismissals: 0,
        avgDismissalsPerUser: 0,
        usersWithDismissals: 0
      }),
      mostDismissedBanners
    };
  };

  // Get users who haven't dismissed a specific banner
  schema.statics.getUsersWhoHaventDismissed = async function(bannerId) {
    const dismissals = await this.find({
      dismissedNotifications: bannerId
    }).distinct('userId');
    
    return dismissals;
  };

  // Clean up old dismissal records
  schema.statics.cleanupOldRecords = async function(daysOld = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    return this.deleteMany({
      updatedAt: { $lt: cutoffDate },
      dismissedNotifications: { $size: 0 }
    });
  };
};