export class CollaborationNotificationGateway {
  async createMessageNotification(_command = {}) {
    throw new Error('CollaborationNotificationGateway.createMessageNotification must be implemented');
  }
}
