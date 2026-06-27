import { NotificationService } from '../../notification/services/notification.service.js';
import { UserModel } from '../../user/models/user/index.js';
import { sendEmail } from '../../../core/email.service.js';
import { wrapEmail, brandedButton } from '../../../core/brand-email.js';

const ALERT_TYPES = {
  auto_paused: {
    title: 'Campaign auto-paused',
    message: (meta) => `Your campaign "${meta.title}" was paused — your wallet balance is too low to fund clicks. Top up to resume.`,
    priority: 'high',
  },
  auto_exhausted: {
    title: 'Campaign budget exhausted',
    message: (meta) => `Your campaign "${meta.title}" has spent its full budget. Top up to reactivate.`,
    priority: 'high',
  },
  low_budget: {
    title: 'Campaign budget running low',
    message: (meta) => `Your campaign "${meta.title}" has ${meta.percent}% budget remaining (₦${meta.remaining}). Consider topping up.`,
    priority: 'medium',
  },
  fraud_flagged: {
    title: 'Suspicious activity detected',
    message: (meta) => `A promoter on your campaign "${meta.title}" was flagged for potentially fraudulent clicks. We've paused their link.`,
    priority: 'medium',
  },
};

export const sendCampaignHealthAlert = async (marketerId, campaignId, type, metadata = {}) => {
  try {
    const alertDef = ALERT_TYPES[type];
    if (!alertDef) return;

    const message = typeof alertDef.message === 'function' ? alertDef.message(metadata) : alertDef.message;

    // In-app notification (SSE + Socket.IO)
    await NotificationService.createNotification({
      recipient: marketerId,
      type: `campaign_${type}`,
      title: alertDef.title,
      message,
      data: { campaignId, ...metadata },
      priority: alertDef.priority,
    });

    // Email notification
    const user = await UserModel.findById(marketerId).select('email displayName notificationSettings').lean();
    if (user?.email && user.notificationSettings?.campaignAssigned?.email !== false) {
      const html = wrapEmail({
        title: alertDef.title,
        preheader: message,
        withFooter: true,
        content: `
          <p style="font-size:15px;line-height:1.6;color:#4b5563">Hi ${user.displayName || 'Marketer'},</p>
          <p style="font-size:15px;line-height:1.6;color:#4b5563">${message}</p>
          ${brandedButton('View Campaign', `${process.env.FRONTEND_URL || 'https://marketspase.com'}/dashboard/campaigns/${campaignId}`)}
        `,
      });
      await sendEmail({ to: user.email, subject: `[Marketspase] ${alertDef.title}`, html }).catch(() => {});
    }
  } catch (error) {
    console.error(`Failed to send campaign health alert (${type}):`, error.message);
  }
};
