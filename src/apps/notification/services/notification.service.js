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

//   static async createNotification(notificationData) {
//     try {
//       return await NotificationModel.createNotification(notificationData);
//     } catch (error) {
//       console.error('Error creating notification:', error);
//       throw error;
//     }
//   }

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