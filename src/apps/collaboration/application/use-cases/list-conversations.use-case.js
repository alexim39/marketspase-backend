import { ListConversationsDto } from '../dto/list-conversations.dto.js';
import {
  conversationMatchesSearch,
  serializeCollaborationConversation,
  toCollaborationIdString,
} from '../mappers/collaboration-conversation.mapper.js';

export class ListConversationsUseCase {
  constructor({ collaborationConversationGateway } = {}) {
    if (!collaborationConversationGateway) {
      throw new Error('collaborationConversationGateway is required');
    }

    this.collaborationConversationGateway = collaborationConversationGateway;
  }

  async execute(input) {
    const dto = input instanceof ListConversationsDto
      ? input
      : new ListConversationsDto(input);

    const conversations = await this.collaborationConversationGateway.listConversations({
      userId: dto.userId,
      kind: dto.kind,
      limit: dto.limit,
    });

    const filteredConversations = dto.search
      ? conversations.filter((conversation) => conversationMatchesSearch(conversation, dto.search))
      : conversations;

    const conversationIds = filteredConversations
      .map((conversation) => conversation?._id)
      .filter(Boolean);

    const unreadCountMap = await this.collaborationConversationGateway.getUnreadCounts({
      conversationIds,
      userId: dto.userId,
    });

    return {
      statusCode: 200,
      headers: {
        'Cache-Control': 'no-store',
      },
      body: {
        success: true,
        data: filteredConversations.map((conversation) =>
          serializeCollaborationConversation(
            conversation,
            dto.userId,
            unreadCountMap.get(toCollaborationIdString(conversation._id)) || 0,
          )
        ),
      },
    };
  }
}
