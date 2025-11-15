import mongoose from 'mongoose';
import { activitySchema } from './activity.schema.js';


const bankDetailsSchema = new mongoose.Schema({
  bank: { type: String, trim: true },
  bankCode: { type: String, trim: true },
  accountNumber: { type: String, trim: true },
  accountName: { type: String, trim: true }
});

const transactionSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    default: () => new mongoose.Types.ObjectId(),
  },
  amount: { type: Number, required: true },
  amountPayable: { type: Number, default: 0 }, // Net amount after fees (for withdrawals)

  type: { 
    type: String, 
    enum: ['credit', 'debit'], 
    required: true 
  }, // credit = money in, debit = money out

  category: { 
    type: String, 
    enum: [
      'deposit',       // funding wallet
      'withdrawal',    // payout to bank/mobile money
      'campaign',      // marketer spend
      'promotion',     // promoter earning
      'bonus',         // referral/loyalty bonus
      'fee',           // platform/admin fees
      'refund',         // marketer refund
      'transfer',
      'commission',
      'reserved_credit',
      'credit',
      'completed'
    ],
    required: true
  },

  description: { type: String, trim: true },

  // Context references (only used if relevant)
  relatedCampaign: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' },
  relatedPromotion: { type: mongoose.Schema.Types.ObjectId, ref: 'Promotion' },

  bankDetails: { type: bankDetailsSchema, default: null },

  // Transaction state tracking
  status: { 
    type: String, 
    enum: [
      'pending', 
      'successful', 
      'failed', 
      'reserved', 
      'processing', 
      'reversed', 
      'cancelled', 
      'completed', 
      'approved', 
      'declined',
      'rejected'
    ], 
    default: 'pending' 
  },

  createdAt: { type: Date, default: Date.now }
});

transactionSchema.pre('validate', function (next) {
  if (!mongoose.isValidObjectId(this._id)) {
    this._id = new mongoose.Types.ObjectId();
  }
  next();
});




const walletSchema = new mongoose.Schema({
  balance: { type: Number, default: 0 },  // Available balance
  reserved: { type: Number, default: 0 }, // Funds locked in escrow
  transactions: [transactionSchema]
});

const payoutAccountSchema = new mongoose.Schema({
  bank: String,
  bankCode: String,
  accountNumber: String,
  accountName: String,
  isDefault: { type: Boolean, default: false }
});

// Notification preferences schema
const notificationPreferenceSchema = new mongoose.Schema({
  email: { 
    type: Boolean, 
    default: true 
  },
  push: { 
    type: Boolean, 
    default: true 
  },
  inApp: { 
    type: Boolean, 
    default: true 
  },
  sms: { 
    type: Boolean, 
    default: false 
  }
}, { _id: false });

// Notification settings schema
const notificationSettingsSchema = new mongoose.Schema({
  // Campaign-related notifications
  campaignAssigned: { type: notificationPreferenceSchema, default: () => ({}) },
  campaignApproved: { type: notificationPreferenceSchema, default: () => ({}) },
  campaignRejected: { type: notificationPreferenceSchema, default: () => ({}) },
  campaignPaused: { type: notificationPreferenceSchema, default: () => ({}) },
  budgetExhausted: { type: notificationPreferenceSchema, default: () => ({}) },
  
  // Promotion-related notifications
  promotionSubmitted: { type: notificationPreferenceSchema, default: () => ({}) },
  promotionValidated: { type: notificationPreferenceSchema, default: () => ({}) },
  promotionRejected: { type: notificationPreferenceSchema, default: () => ({}) },
  submissionReminder: { type: notificationPreferenceSchema, default: () => ({}) },
  
  // Payment-related notifications
  paymentReceived: { type: notificationPreferenceSchema, default: () => ({}) },
  paymentProcessed: { type: notificationPreferenceSchema, default: () => ({}) },
  payoutReady: { type: notificationPreferenceSchema, default: () => ({}) },
  lowBalance: { type: notificationPreferenceSchema, default: () => ({}) },
  
  // System notifications
  weeklySummary: { type: notificationPreferenceSchema, default: () => ({}) },
  systemUpdates: { type: notificationPreferenceSchema, default: () => ({}) },
  securityAlerts: { type: notificationPreferenceSchema, default: () => ({}) }
}, { _id: false });

// User notification stats
const notificationStatsSchema = new mongoose.Schema({
  totalReceived: { type: Number, default: 0 },
  totalRead: { type: Number, default: 0 },
  lastReadAt: { type: Date, default: null },
  muteUntil: { type: Date, default: null }
}, { _id: false });

const userSchema = new mongoose.Schema(
  {
    uid: { type: String, unique: true, required: true },
    username: { type: String, unique: true, required: true, trim: true },
    displayName: { type: String, trim: true, required: true },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
    },
    password: {
      type: String,
      trim: true,
      required: function () { return this.authenticationMethod === 'local'; },
    },
    authenticationMethod: {
      type: String,
      enum: ['local', 'google.com', 'facebook.com', 'twitter.com'],
      default: 'google.com',
    },

    role: {
      type: String,
      enum: ['marketer', 'promoter', 'admin'],
      default: 'marketer',
    },

    avatar: { type: String, default: '/img/avatar.png' },

    // Dual wallets (separate tracking for each role)
    wallets: {
      marketer: { type: walletSchema, default: () => ({}) },
      promoter: { type: walletSchema, default: () => ({}) },
    },

    savedAccounts: [payoutAccountSchema],

    // Engagement & trust
    rating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    testimonials: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Testimonial' }],

    // System flags
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },

    // Notification system fields
    notificationSettings: { 
      type: notificationSettingsSchema, 
      default: () => ({}) 
    },
    notificationStats: { 
      type: notificationStatsSchema, 
      default: () => ({}) 
    },
    deviceTokens: [{
      token: { type: String, required: true },
      platform: { type: String, enum: ['web', 'ios', 'android'], required: true },
      lastActive: { type: Date, default: Date.now }
    }],
    sseConnections: [{
      connectionId: { type: String, required: true },
      lastActive: { type: Date, default: Date.now },
      userAgent: String,
      ipAddress: String
    }],

    // Targeting info
    personalInfo: {
      address: {
        street: { type: String, trim: true },
        city: { type: String, trim: true },
        state: { type: String, trim: true },
        country: { type: String, trim: true }
      },
      phone: { 
        type: String, 
        trim: true, 
        default: null  // Explicit default
      },
      dob: { type: Date },
      biography: { type: String, trim: true },
      gender: { type: String, default: '' },
    },
    professionalInfo: {
      skills: [{ type: String }],
      jobTitle: { type: String, trim: true },
      experience: {
        company: String,
        startDate: Date,
        endDate: Date,
        description: String,
        current: Boolean
      },
      education: {
        institution: String,
        certificate: String,
        fieldOfStudy: String,
        startDate: Date,
        endDate: Date,
        description: String
      }
    },
    interests: {
      hobbies: [{ type: String }],
      favoriteTopics: [{ type: String }]
    },
    preferences: {
      notification: {
        type: Boolean,
        default: true,
      },
      categoryBasedAds: {
        type: Boolean,
        default: false,
      },
      locationBasedAds: {
        type: Boolean,
        default: false,
      },
      adCategories: [{ type: String }],
    },

    // Add activity tracking array
    activityLog: [activitySchema],
      
    // Activity tracking settings
    activitySettings: {
      retainPeriod: { 
        type: Number, 
        default: 365, // Days to retain activity logs
        min: 30,
        max: 1095 // 3 years max
      },
      enabled: { 
        type: Boolean, 
        default: true 
      }
    },

  },
  { timestamps: true }
);

// Instance methods for notification management
userSchema.methods = {
  // Check if user allows a specific notification type
  canReceiveNotification(notificationType, channel = 'inApp') {
    if (this.notificationStats.muteUntil && this.notificationStats.muteUntil > new Date()) {
      return false;
    }

    const setting = this.notificationSettings[notificationType];
    if (!setting) return true; // Default to true if setting not found

    return setting[channel] !== false;
  },

  // Add device token for push notifications
  addDeviceToken(token, platform) {
    const existingToken = this.deviceTokens.find(t => t.token === token);
    if (existingToken) {
      existingToken.lastActive = new Date();
    } else {
      this.deviceTokens.push({ token, platform, lastActive: new Date() });
    }
    return this.save();
  },

  // Remove device token
  removeDeviceToken(token) {
    this.deviceTokens = this.deviceTokens.filter(t => t.token !== token);
    return this.save();
  },

  // Add SSE connection
  addSSEConnection(connectionId, userAgent, ipAddress) {
    this.sseConnections.push({
      connectionId,
      userAgent,
      ipAddress,
      lastActive: new Date()
    });
    return this.save();
  },

  // Remove SSE connection
  removeSSEConnection(connectionId) {
    this.sseConnections = this.sseConnections.filter(conn => conn.connectionId !== connectionId);
    return this.save();
  },

  // Clean up inactive SSE connections (older than 24 hours)
  cleanupInactiveConnections() {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    this.sseConnections = this.sseConnections.filter(
      conn => conn.lastActive > twentyFourHoursAgo
    );
    return this.save();
  },

  // Update notification stats when a notification is read
  markNotificationRead() {
    this.notificationStats.totalRead += 1;
    this.notificationStats.lastReadAt = new Date();
    return this.save();
  },

  // Mute all notifications until a specific date
  muteNotifications(untilDate) {
    this.notificationStats.muteUntil = untilDate;
    return this.save();
  },

  // Unmute notifications
  unmuteNotifications() {
    this.notificationStats.muteUntil = null;
    return this.save();
  },


  // Log user activity
  logActivity(action, description, options = {}) {
    //console.log('LogActivity called:', { action, description, options });
    
    if (!this.activitySettings.enabled) {
      console.log('Activity logging disabled');
      return Promise.resolve(this);
    }
    
    const activity = {
      action,
      description,
      resourceType: options.resourceType,
      resourceId: options.resourceId,
      metadata: options.metadata || {},
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      timestamp: new Date()
    };
    
    //console.log('Activity to be saved:', activity);
    
    this.activityLog.unshift(activity);
    
    // Limit the number of stored activities
    const maxActivities = 1000;
    if (this.activityLog.length > maxActivities) {
      this.activityLog = this.activityLog.slice(0, maxActivities);
    }
    
    return this.save().then(result => {
      console.log('Activity saved successfully');
      return result;
    }).catch(error => {
      console.error('Failed to save activity:', error);
      throw error;
    });
  },

  // Get recent activities with pagination
  getRecentActivities(limit = 50, offset = 0) {
    return this.activityLog.slice(offset, offset + limit);
  },
  
  // Search activities by action or description
  searchActivities(query, limit = 50) {
    const searchRegex = new RegExp(query, 'i');
    return this.activityLog.filter(activity => 
      searchRegex.test(activity.action) || 
      searchRegex.test(activity.description)
    ).slice(0, limit);
  },
  
  // Clean up old activities based on retain period
  cleanupOldActivities() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.activitySettings.retainPeriod);
    
    this.activityLog = this.activityLog.filter(
      activity => activity.timestamp > cutoffDate
    );
    
    return this.save();
  }

};

// Static methods for user model
userSchema.statics = {
  // Find users by role with notification preferences
  async findByRoleWithNotifications(role, notificationType) {
    return this.find({
      role,
      'notificationSettings': { $exists: true }
    }).select('uid email notificationSettings deviceTokens');
  },

  // Find users who should receive a specific notification type
  async findUsersForNotification(notificationType, channel = 'inApp') {
    return this.find({
      'isActive': true,
      'isDeleted': false,
      $or: [
        { [`notificationSettings.${notificationType}.${channel}`]: true },
        { [`notificationSettings.${notificationType}.${channel}`]: { $exists: false } }
      ]
    });
  },

  // Clean up all inactive connections across all users
  async cleanupAllInactiveConnections() {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    return this.updateMany(
      { 'sseConnections.lastActive': { $lt: twentyFourHoursAgo } },
      { 
        $pull: { 
          sseConnections: { lastActive: { $lt: twentyFourHoursAgo } } 
        } 
      }
    );
  },


  // Find users by recent activity
  async findByRecentActivity(action, hours = 24) {
    const cutoffDate = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    return this.find({
      'activityLog': {
        $elemMatch: {
          action: action,
          timestamp: { $gte: cutoffDate }
        }
      }
    });
  },
  
  // Bulk cleanup of old activities across all users
  async cleanupAllOldActivities() {
    const users = await this.find({ 'activitySettings.retainPeriod': { $exists: true } });
    
    const cleanupPromises = users.map(user => user.cleanupOldActivities());
    return Promise.all(cleanupPromises);
  },
  
  // Get system-wide activity statistics
  async getActivityStats(days = 30) {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    return this.aggregate([
      { $unwind: '$activityLog' },
      { $match: { 'activityLog.timestamp': { $gte: cutoffDate } } },
      {
        $group: {
          _id: '$activityLog.action',
          count: { $sum: 1 },
          lastPerformed: { $max: '$activityLog.timestamp' }
        }
      },
      { $sort: { count: -1 } }
    ]);
  }
};

// Middleware to set default notification settings based on role
userSchema.pre('save', function(next) {
  if (this.isNew) {
    // Set role-specific default notification preferences
    const defaultSettings = {
      // Marketers typically want all business-related notifications
      marketer: {
        campaignApproved: { inApp: true, email: true, push: true },
        campaignRejected: { inApp: true, email: true, push: true },
        budgetExhausted: { inApp: true, email: true, push: true },
        promotionSubmitted: { inApp: true, email: false, push: true },
        lowBalance: { inApp: true, email: true, push: true },
        weeklySummary: { inApp: true, email: true, push: false }
      },
      // Promoters typically want assignment and payment notifications
      promoter: {
        campaignAssigned: { inApp: true, email: false, push: true },
        promotionValidated: { inApp: true, email: false, push: true },
        promotionRejected: { inApp: true, email: false, push: true },
        submissionReminder: { inApp: true, email: false, push: true },
        paymentReceived: { inApp: true, email: true, push: true },
        payoutReady: { inApp: true, email: true, push: true },
        weeklySummary: { inApp: true, email: true, push: false }
      },
      // Admins typically want system-level notifications
      admin: {
        systemUpdates: { inApp: true, email: true, push: true },
        securityAlerts: { inApp: true, email: true, push: true }
      }
    };

    // Apply role-specific defaults
    const roleDefaults = defaultSettings[this.role] || {};
    this.notificationSettings = { ...this.notificationSettings, ...roleDefaults };
  }

  // Only log if this is an existing document being modified
  if (!this.isNew && this.isModified()) {
    const modifiedFields = Object.keys(this.modifiedPaths());
    
    // Log profile updates
    if (modifiedFields.some(field => field.startsWith('personalInfo') || 
                                    field.startsWith('professionalInfo'))) {
      this.logActivity('profile_update', 'User updated profile information', {
        metadata: { modifiedFields }
      }).catch(console.error); // Prevent save failure if logging fails
    }
    
    // Log notification settings changes
    if (modifiedFields.some(field => field.startsWith('notificationSettings'))) {
      this.logActivity('notification_settings_update', 'User updated notification preferences', {
        metadata: { modifiedFields }
      }).catch(console.error);
    }
    
    // Log preference changes
    if (modifiedFields.some(field => field.startsWith('preferences'))) {
      this.logActivity('preferences_update', 'User updated application preferences', {
        metadata: { modifiedFields }
      }).catch(console.error);
    }
  }

  const wallets = [this.wallets?.promoter, this.wallets?.marketer];
  wallets.forEach(wallet => {
    if (wallet && Array.isArray(wallet.transactions)) {
      wallet.transactions.forEach(tx => {
        if (!mongoose.isValidObjectId(tx._id)) {
          tx._id = new mongoose.Types.ObjectId();
        }
      });
    }
  });
  next();
});

export const UserModel = mongoose.model('User', userSchema);