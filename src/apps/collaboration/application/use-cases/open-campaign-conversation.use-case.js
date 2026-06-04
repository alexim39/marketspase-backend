import { OpenCampaignConversationDto } from '../dto/open-campaign-conversation.dto.js';
import { serializeCollaborationConversation } from '../mappers/collaboration-conversation.mapper.js';

export class OpenCampaignConversationUseCase {
  constructor({ collaborationConversationGateway } = {}) {
    if (!collaborationConversationGateway) {
      throw new Error('collaborationConversationGateway is required');
    }

    this.collaborationConversationGateway = collaborationConversationGateway;
  }

  async execute(input) {
    const dto = input instanceof OpenCampaignConversationDto
      ? input
      : new OpenCampaignConversationDto(input);

    const conversation = await this.collaborationConversationGateway.openCampaignConversation({
      actor: dto.user,
      campaignId: dto.campaignId,
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
