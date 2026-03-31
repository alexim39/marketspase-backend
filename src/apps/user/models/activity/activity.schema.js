import mongoose from "mongoose";
import { 
  ACTIVITY_ACTIONS_ARRAY, 
  RESOURCE_TYPES_ARRAY,
  DEFAULTS 
} from "./activity.constants.js";

const activitySchema = new mongoose.Schema({
  // User reference (if we want to add user later)
  // userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  
  action: {
    type: String,
    required: true,
    enum: ACTIVITY_ACTIONS_ARRAY
  },
  
  description: { 
    type: String, 
    required: true 
  },
  
  // Resource that was affected (optional)
  resourceType: {
    type: String,
    enum: RESOURCE_TYPES_ARRAY
  },
  
  resourceId: {
    type: mongoose.Schema.Types.ObjectId
  },
  
  // Additional metadata about the activity
  metadata: {
    type: mongoose.Schema.Types.Mixed, // Flexible object for additional data
    default: DEFAULTS.METADATA
  },
  
  ipAddress: { 
    type: String 
  },
  
  userAgent: { 
    type: String 
  },
  
  // Severity level for filtering important activities
  severity: {
    type: String,
    enum: ['info', 'warning', 'critical'],
    default: DEFAULTS.SEVERITY
  },
  
  timestamp: { 
    type: Date, 
    default: Date.now,
    index: true 
  }
}, { 
  _id: true,
  timestamps: true // Adds createdAt and updatedAt automatically
});

export default activitySchema;

/* import mongoose from 'mongoose';

// Add this new schema for activity tracking
export const activitySchema = new mongoose.Schema({
  
  action: {
    type: String,
    required: true,
    enum: [
      // Authentication & Profile
      'login', 'logout', 'profile_update', 'password_change', 'email_verify', 'referred_signup', 'signup',
      
      // Wallet & Financial
      'wallet_fund', 'withdrawal_request', 'withdrawal_complete', 'transfer', 'promo_credit_claimed',
      'withdrawal_approved', 'withdrawal_rejected', 'referral_bonus_qualified', 'referral_bonus_paid',
      'refund_received', 'birthday_bonus_received',
      
      // Campaign & Promotion
      'campaign_create', 'campaign_update', 'campaign_delete', 'campaign_pause',
      'promotion_submit', 'promotion_approve', 'promotion_reject', 'campaign_accept',
      'campaign_download', 'campaign_created', 'promotion_validated', 'promotion_downloaded',
      
      // Notification & Settings
      'notification_settings_update', 'preferences_update',
      
      // Account Management
      'device_add', 'device_remove', 'payout_account_add', 'payout_account_remove',
      
      // System
      'role_change', 'account_verify', 'account_suspend'
    ]
  },
  
  description: { 
    type: String, 
    required: true 
  },
  
  // Resource that was affected (optional)
  resourceType: {
    type: String,
    enum: ['user', 'campaign', 'promotion', 'wallet', 'transaction', 'notification', 'device', 'payout_account', 'bonus', 'referral']
  },
  
  resourceId: {
    type: mongoose.Schema.Types.ObjectId
  },
  
  // Additional metadata about the activity
  metadata: {
    type: mongoose.Schema.Types.Mixed, // Flexible object for additional data
    default: {}
  },
  
  ipAddress: { type: String },
  userAgent: { type: String },
  
  timestamp: { 
    type: Date, 
    default: Date.now 
  }
}, { 
  _id: true,
});
 */
// Optional: Create and export the Activity model as well
//export const ActivityModel = mongoose.model('Activity', activitySchema);