import { GetConversationMessagesDto } from '../dto/get-conversation-messages.dto.js';
import { serializeCollaborationConversation } from '../mappers/collaboration-conversation.mapper.js';

export class GetConversationMessagesUseCase {
  constructor({ collaborationConversationGateway } = {}) {
    if (!collaborationConversationGateway) {
      throw new Error('collaborationConversationGateway is required');
    }

    this.collaborationConversationGateway = collaborationConversationGateway;
  }

  async execute(input) {
    const dto = input instanceof GetConversationMessagesDto
      ? input
      : new GetConversationMessagesDto(input);

    const conversation = await this.collaborationConversationGateway.loadConversationForUser(
      dto.conversationId,
      dto.user,
    );

    const { messages, total } = await this.collaborationConversationGateway.listMessages({
      conversationId: conversation._id,
      page: dto.page,
      limit: dto.limit,
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        data: {
          conversation: serializeCollaborationConversation(conversation, dto.user?._id, 0),
          messages,
          pagination: {
            page: dto.page,
            limit: dto.limit,
            total,
            totalPages: Math.max(Math.ceil(total / dto.limit), 1),
          },
        },
      },
    };
  }
}
