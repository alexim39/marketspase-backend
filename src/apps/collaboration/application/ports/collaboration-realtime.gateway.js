export class CollaborationRealtimeGateway {
  notifyMessage(_command = {}) {
    throw new Error('CollaborationRealtimeGateway.notifyMessage must be implemented');
  }

  notifyConversationUpdate(_command = {}) {
    throw new Error('CollaborationRealtimeGateway.notifyConversationUpdate must be implemented');
  }
}
