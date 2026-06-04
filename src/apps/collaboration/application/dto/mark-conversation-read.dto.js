export class MarkConversationReadDto {
  constructor({ user = null, conversationId = '' } = {}) {
    this.user = user || null;
    this.conversationId = conversationId || '';
  }

  static fromRequest({ user = null, params = {} } = {}) {
    return new MarkConversationReadDto({
      user: user || null,
      conversationId: params.conversationId,
    });
  }
}
