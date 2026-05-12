// services/notification.service.js
import { NotificationModel } from '../models/notification.model.js';
import { sendSSEToUser } from '../controllers/notifications.js';

export class NotificationService {

  static async createNotification(notificationData) {
    try {
      const notification = await NotificationModel.createNotification(notificationData);
      
      // Send real-time update via SSE
      sendSSEToUser(notificationData.recipient, {
        type: 'new-notification',
        notification
      });
      
      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  // WHERE TO USE: In campaign scheduling service - send reminders to promoters who haven't submitted proof before deadline
  static async createSubmissionReminder(userId, campaign, promotion, hoursLeft) {
    return this.createNotification({
      recipient: userId,
      type: 'submission_reminder',
      title: 'Status Expiring Soon! ⏰',
      message: `URGENT: Your WhatsApp status for "${campaign.title}" expires in ${hoursLeft} hour(s)! Submit your proof now before it disappears.`,
      data: {
        campaignId: campaign._id,
        promotionId: promotion._id,
        hoursLeft,
        expiresAt: new Date(Date.now() + hoursLeft * 60 * 60 * 1000), // Calculate expiration time
        actionUrl: `/promotions/${promotion._id}/submit`
      },
      priority: hoursLeft <= 3 ? 'high' : 'medium', // High priority if less than 3 hours left
      urgency: 'time-sensitive'
    });
  }

  // WHERE TO USE: In payment processing service - notify promoter when their earnings are ready for withdrawal
  static async createPayoutReadyNotification(promoterId, amount, pendingPayoutsCount) {
    return this.createNotification({
      recipient: promoterId,
      type: 'payout_ready',
      title: 'Payout Ready!',
      message: `₦${amount} is ready for withdrawal. You have ${pendingPayoutsCount} completed promotions.`,
      data: {
        amount,
        pendingPayoutsCount,
        actionUrl: '/wallet/withdraw'
      },
      priority: 'high'
    });
  }

  // WHERE TO USE: In admin dashboard - when admin approves a marketer's campaign
  static async createCampaignApprovedNotification(marketerId, campaign) {
    return this.createNotification({
      recipient: marketerId,
      type: 'campaign_approved',
      title: 'Campaign Approved!',
      message: `Your campaign "${campaign.title}" has been approved and is now active.`,
      data: {
        campaignId: campaign._id,
        campaignTitle: campaign.title,
        actionUrl: `/campaigns/${campaign._id}`
      },
      priority: 'medium'
    });
  }

  // WHERE TO USE: In admin dashboard - when admin rejects a marketer's campaign with reason
  static async createCampaignRejectedNotification(marketerId, campaign, rejectionReason) {
    return this.createNotification({
      recipient: marketerId,
      type: 'campaign_rejected',
      title: 'Campaign Requires Changes',
      message: `Your campaign "${campaign.title}" was rejected: ${rejectionReason}`,
      data: {
        campaignId: campaign._id,
        campaignTitle: campaign.title,
        rejectionReason,
        actionUrl: `/campaigns/${campaign._id}/edit`
      },
      priority: 'medium'
    });
  }

  // WHERE TO USE: In campaign monitoring service - when campaign budget is fully utilized
  static async createBudgetExhaustedNotification(marketerId, campaign) {
    return this.createNotification({
      recipient: marketerId,
      type: 'budget_exhausted',
      title: 'Campaign Budget Exhausted',
      message: `Budget for "${campaign.title}" has been fully utilized. Campaign has been paused.`,
      data: {
        campaignId: campaign._id,
        campaignTitle: campaign.title,
        spentAmount: campaign.spentAmount,
        totalBudget: campaign.budget,
        actionUrl: `/campaigns/${campaign._id}/budget`
      },
      priority: 'high'
    });
  }

  // WHERE TO USE: In marketer dashboard - when marketer rejects a promoter's submitted proof
  static async createPromotionRejectedNotification(promoterId, promotion, campaign, rejectionReason) {
    return this.createNotification({
      recipient: promoterId,
      type: 'promotion_rejected',
      title: 'Proof Rejected',
      message: `Your submission for "${campaign.title}" was rejected: ${rejectionReason}`,
      data: {
        campaignId: campaign._id,
        promotionId: promotion._id,
        rejectionReason,
        actionUrl: `/promotions/${promotion._id}/resubmit`
      },
      priority: 'medium'
    });
  }

  // Existing methods below...
  static async createPromotionAssignedNotification(promoterId, campaign, promotion) {
    return this.createNotification({
      recipient: promoterId,
      type: 'promotion_assigned',
      title: 'New Promotion Assigned',
      message: `You've been assigned to promote: "${campaign.title}"`,
      data: {
        campaignId: campaign._id,
        promotionId: promotion._id,
        actionUrl: `/promotions/${promotion._id}`
      },
      priority: 'high'
    });
  }

  static async createPromotionSubmittedNotification(campaignOwnerId, promotion, campaign) {
    return this.createNotification({
      recipient: campaignOwnerId,
      type: 'promotion_submitted',
      title: 'Proof Submitted',
      message: `A promoter has submitted proof for "${campaign.title}"`,
      data: {
        campaignId: campaign._id,
        promotionId: promotion._id,
        actionUrl: `/campaigns/${campaign._id}/promotions`
      },
      priority: 'medium'
    });
  }

  static async createPromotionValidatedNotification(promoterId, promotion, campaign) {
    return this.createNotification({
      recipient: promoterId,
      type: 'promotion_validated',
      title: 'Promotion Validated!',
      message: `Your promotion for "${campaign.title}" has been validated and approved for payment.`,
      data: {
        campaignId: campaign._id,
        promotionId: promotion._id,
        amount: promotion.payoutAmount,
        actionUrl: `/promotions/${promotion._id}`
      },
      priority: 'high'
    });
  }

  static async createPaymentProcessedNotification(userId, amount, promotion, type = 'promoter') {
    const isPromoter = type === 'promoter';
    const title = isPromoter ? 'Payment Received' : 'Payment Processed';
    const message = isPromoter 
      ? `You've received ₦${amount} for your promotion`
      : `Payment of ₦${amount} processed for campaign promotion`;

    return this.createNotification({
      recipient: userId,
      type: 'payment_processed',
      title,
      message,
      data: {
        promotionId: promotion?._id,
        amount,
        actionUrl: isPromoter ? '/wallet' : '/campaigns'
      },
      priority: 'high'
    });
  }

  static async createLowBalanceNotification(marketerId, currentBalance, campaign) {
    return this.createNotification({
      recipient: marketerId,
      type: 'low_balance',
      title: 'Low Wallet Balance',
      message: `Your wallet balance (₦${currentBalance}) is low. Add funds to continue running campaigns.`,
      data: {
        campaignId: campaign?._id,
        currentBalance,
        actionUrl: '/wallet/deposit'
      },
      priority: 'high'
    });
  }

  static async createBadgeUnlockedNotification(userId, badge) {
    return this.createNotification({
      recipient: userId,
      type: 'badge_unlocked',
      title: 'New Badge Unlocked',
      message: `You unlocked "${badge.titleSnapshot}". Nice work keeping the momentum up.`,
      data: {
        actionUrl: '/profile',
        metadata: {
          badgeId: badge._id,
          badgeKey: badge.badgeKey,
          badgeTitle: badge.titleSnapshot,
          badgeIcon: badge.iconSnapshot,
          badgeColor: badge.accentColorSnapshot,
          experiencePoints: badge.rewardSnapshot?.experiencePoints || 0,
        },
      },
      priority: 'medium',
    });
  }

  static async markAsRead(notificationId, userId) {
    return NotificationModel.findOneAndUpdate(
      { _id: notificationId, recipient: userId },
      { 
        status: 'read',
        readAt: new Date()
      },
      { new: true }
    );
  }

  static async markAllAsRead(userId) {
    return NotificationModel.updateMany(
      { recipient: userId, status: 'unread' },
      { 
        status: 'read',
        readAt: new Date()
      }
    );
  }

  static async getUserNotificationCount(userId) {
    return NotificationModel.countDocuments({
      recipient: userId,
      status: 'unread'
    });
  }
}
