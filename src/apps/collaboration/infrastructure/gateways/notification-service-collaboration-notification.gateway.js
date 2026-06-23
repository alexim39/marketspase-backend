import { NotificationService } from '../../../notification/services/notification.service.js';
import { CollaborationNotificationGateway } from '../../application/ports/collaboration-notification.gateway.js';

export class NotificationServiceCollaborationNotificationGateway extends CollaborationNotificationGateway {
  async createMessageNotification({ recipientId, conversation, sender, content, priority } = {}) {
    return NotificationService.createCollaborationMessageNotification(
      recipientId,
      conversation,
      sender,
      content,
      priority,
    );
  }
}
