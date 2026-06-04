export class SendConversationMessageDto {
  constructor({ user = null, conversationId = null, content = '', attachments = [], io = null } = {}) {
    this.user = user;
    this.conversationId = conversationId;
    this.content = String(content || '').trim();
    this.attachments = Array.isArray(attachments) ? attachments : [];
    this.io = io;
  }

  static fromRequest({ user = null, params = {}, body = {}, io = null } = {}) {
    return new SendConversationMessageDto({
      user,
      conversationId: params?.conversationId || null,
      content: body?.content || '',
      attachments: body?.attachments,
      io,
    });
  }
}
