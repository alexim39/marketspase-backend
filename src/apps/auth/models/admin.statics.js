import { ERROR_MESSAGES } from "./admin.constants.js";

export const setupAdminStatics = (schema) => {
  // Find admin by email with password included
  schema.statics.findByEmailWithPassword = function(email) {
    return this.findOne({ email }).select('+password');
  };

  // Find admin by ID with sensitive fields
  schema.statics.findByIdWithSensitive = function(id) {
    return this.findById(id).select('+password +twoFactorSecret +refreshToken');
  };

  // Authenticate admin (for login)
  schema.statics.authenticate = async function(email, password) {
    const admin = await this.findOne({ email })
      .select('+password')
      .where('isDeleted').equals(false)
      .where('isActive').equals(true);

    if (!admin) {
      throw new Error(ERROR_MESSAGES.INVALID_CREDENTIALS);
    }

    const isPasswordValid = await admin.comparePassword(password);
    if (!isPasswordValid) {
      throw new Error(ERROR_MESSAGES.INVALID_CREDENTIALS);
    }

    return admin;
  };

  // Find active admins
  schema.statics.findActive = function() {
    return this.find({ 
      isActive: true, 
      isDeleted: false 
    }).sort({ createdAt: -1 });
  };

  // Find admins by role
  schema.statics.findByRole = function(role) {
    return this.find({ 
      role, 
      isActive: true, 
      isDeleted: false 
    }).sort({ createdAt: -1 });
  };

  // Get admin statistics
  schema.statics.getStats = async function() {
    const stats = await this.aggregate([
      { $match: { isDeleted: false } },
      { $group: {
        _id: '$role',
        count: { $sum: 1 },
        activeCount: {
          $sum: { $cond: ['$isActive', 1, 0] }
        },
        inactiveCount: {
          $sum: { $cond: ['$isActive', 0, 1] }
        }
      }},
      { $sort: { _id: 1 } }
    ]);

    const total = await this.countDocuments({ isDeleted: false });
    const active = await this.countDocuments({ isActive: true, isDeleted: false });
    const twoFactorEnabled = await this.countDocuments({ 
      twoFactorEnabled: true, 
      isDeleted: false 
    });

    return {
      total,
      active,
      inactive: total - active,
      twoFactorEnabled,
      byRole: stats,
      recentLogins: await this.getRecentLoginActivity(7) // Last 7 days
    };
  };

  // Get recent login activity
  schema.statics.getRecentLoginActivity = async function(days = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return this.aggregate([
      { $unwind: '$loginHistory' },
      { $match: { 
        'loginHistory.timestamp': { $gte: cutoffDate },
        'loginHistory.success': true 
      }},
      { $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$loginHistory.timestamp' } }
        },
        count: { $sum: 1 }
      }},
      { $sort: { '_id.date': -1 } }
    ]);
  };

  // Find admins who haven't logged in recently
  schema.statics.findInactiveAdmins = function(days = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return this.find({
      isActive: true,
      isDeleted: false,
      $or: [
        { lastLogin: { $lt: cutoffDate } },
        { lastLogin: { $exists: false } }
      ]
    });
  };

  // Bulk update admin status
  schema.statics.bulkUpdateStatus = async function(adminIds, isActive, updatedBy) {
    return this.updateMany(
      { _id: { $in: adminIds } },
      { 
        $set: { 
          isActive, 
          updatedBy,
          updatedAt: new Date()
        }
      }
    );
  };

  // Search admins by name or email
  schema.statics.search = function(query, limit = 20) {
    return this.find({
      $or: [
        { email: { $regex: query, $options: 'i' } },
        { name: { $regex: query, $options: 'i' } }
      ],
      isDeleted: false
    })
    .limit(limit)
    .sort({ createdAt: -1 });
  };

  // Check if email exists
  schema.statics.isEmailTaken = async function(email, excludeId = null) {
    const query = { email };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }
    const count = await this.countDocuments(query);
    return count > 0;
  };
};