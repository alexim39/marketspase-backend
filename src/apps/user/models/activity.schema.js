import mongoose from 'mongoose';

// Add this new schema for activity tracking
export const activitySchema = new mongoose.Schema({
  
  action: {
    type: String,
    required: true,
    enum: [
      // Authentication & Profile
      'login', 'logout', 'profile_update', 'password_change', 'email_verify',
      
      // Wallet & Financial
      'wallet_fund', 'withdrawal_request', 'withdrawal_complete', 'transfer',
      
      // Campaign & Promotion
      'campaign_create', 'campaign_update', 'campaign_delete', 'campaign_pause',
      'promotion_submit', 'promotion_approve', 'promotion_reject', 'campaign_accepted',
      'campaign_download', 'campaign_created',
      
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
    enum: ['user', 'campaign', 'promotion', 'wallet', 'transaction', 'notification', 'device', 'payout_account']
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

// Optional: Create and export the Activity model as well
export const Activity = mongoose.model('Activity', activitySchema);