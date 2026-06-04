import { MarkConversationReadDto } from '../dto/mark-conversation-read.dto.js';

export class MarkConversationReadUseCase {
  constructor({ collaborationConversationGateway } = {}) {
    if (!collaborationConversationGateway) {
      throw new Error('collaborationConversationGateway is required');
    }

    this.collaborationConversationGateway = collaborationConversationGateway;
  }

  async execute(input) {
    const dto = input instanceof MarkConversationReadDto
      ? input
      : new MarkConversationReadDto(input);

    const conversation = await this.collaborationConversationGateway.loadConversationForUser(
      dto.conversationId,
      dto.user,
    );

    await this.collaborationConversationGateway.markConversationRead({
      conversationId: conversation._id,
      userId: dto.user?._id,
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        message: 'Conversation marked as read.',
      },
    };
  }
}
