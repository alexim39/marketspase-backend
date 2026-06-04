export class CollaborationConversationGateway {
  async listConversations(_query = {}) {
    throw new Error('CollaborationConversationGateway.listConversations must be implemented');
  }

  async getUnreadCounts(_query = {}) {
    throw new Error('CollaborationConversationGateway.getUnreadCounts must be implemented');
  }

  async loadConversationForUser(_conversationId, _user) {
    throw new Error('CollaborationConversationGateway.loadConversationForUser must be implemented');
  }

  async createDirectConversation(_command = {}) {
    throw new Error('CollaborationConversationGateway.createDirectConversation must be implemented');
  }

  async openCampaignConversation(_command = {}) {
    throw new Error('CollaborationConversationGateway.openCampaignConversation must be implemented');
  }

  async openPromotionConversation(_command = {}) {
    throw new Error('CollaborationConversationGateway.openPromotionConversation must be implemented');
  }

  async listMessages(_query = {}) {
    throw new Error('CollaborationConversationGateway.listMessages must be implemented');
  }

  async createMessage(_command = {}) {
    throw new Error('CollaborationConversationGateway.createMessage must be implemented');
  }

  async updateConversationLastMessage(_command = {}) {
    throw new Error('CollaborationConversationGateway.updateConversationLastMessage must be implemented');
  }

  async getMessageById(_messageId) {
    throw new Error('CollaborationConversationGateway.getMessageById must be implemented');
  }

  async markConversationRead(_command = {}) {
    throw new Error('CollaborationConversationGateway.markConversationRead must be implemented');
  }
}
