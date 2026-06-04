import { OpenPromotionConversationDto } from '../dto/open-promotion-conversation.dto.js';
import { serializeCollaborationConversation } from '../mappers/collaboration-conversation.mapper.js';

export class OpenPromotionConversationUseCase {
  constructor({ collaborationConversationGateway } = {}) {
    if (!collaborationConversationGateway) {
      throw new Error('collaborationConversationGateway is required');
    }

    this.collaborationConversationGateway = collaborationConversationGateway;
  }

  async execute(input) {
    const dto = input instanceof OpenPromotionConversationDto
      ? input
      : new OpenPromotionConversationDto(input);

    const conversation = await this.collaborationConversationGateway.openPromotionConversation({
      actor: dto.user,
      promotionId: dto.promotionId,
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        data: serializeCollaborationConversation(conversation, dto.user?._id, 0),
      },
    };
  }
}
