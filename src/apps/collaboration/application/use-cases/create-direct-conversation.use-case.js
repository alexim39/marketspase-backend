import { CreateDirectConversationDto } from '../dto/create-direct-conversation.dto.js';
import { serializeCollaborationConversation } from '../mappers/collaboration-conversation.mapper.js';

export class CreateDirectConversationUseCase {
  constructor({ collaborationConversationGateway } = {}) {
    if (!collaborationConversationGateway) {
      throw new Error('collaborationConversationGateway is required');
    }

    this.collaborationConversationGateway = collaborationConversationGateway;
  }

  async execute(input) {
    const dto = input instanceof CreateDirectConversationDto
      ? input
      : new CreateDirectConversationDto(input);

    const conversation = await this.collaborationConversationGateway.createDirectConversation({
      actor: dto.user,
      targetUserId: dto.targetUserId,
      campaignId: dto.campaignId,
      promotionId: dto.promotionId,
    });

    return {
      statusCode: 201,
      body: {
        success: true,
        data: serializeCollaborationConversation(conversation, dto.user?._id, 0),
      },
    };
  }
}
