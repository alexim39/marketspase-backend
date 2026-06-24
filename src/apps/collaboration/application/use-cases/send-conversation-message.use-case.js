import { SendConversationMessageDto } from '../dto/send-conversation-message.dto.js';
import { toCollaborationIdString } from '../mappers/collaboration-conversation.mapper.js';
import { extractMentions, resolveMentions } from '../../services/mention.service.js';

const getParticipantIds = (conversation) => (conversation.participants || [])
  .map((participant) => toCollaborationIdString(participant.user?._id || participant.user))
  .filter(Boolean);

export class SendConversationMessageUseCase {
  constructor({
    collaborationConversationGateway,
    collaborationNotificationGateway,
    collaborationRealtimeGateway,
  } = {}) {
    if (!collaborationConversationGateway) {
      throw new Error('collaborationConversationGateway is required');
    }

    if (!collaborationNotificationGateway) {
      throw new Error('collaborationNotificationGateway is required');
    }

    if (!collaborationRealtimeGateway) {
      throw new Error('collaborationRealtimeGateway is required');
    }

    this.collaborationConversationGateway = collaborationConversationGateway;
    this.collaborationNotificationGateway = collaborationNotificationGateway;
    this.collaborationRealtimeGateway = collaborationRealtimeGateway;
  }

  async execute(input) {
    const dto = input instanceof SendConversationMessageDto
      ? input
      : new SendConversationMessageDto(input);

    if (!dto.content && (!dto.attachments || dto.attachments.length === 0)) {
      return {
        statusCode: 400,
        body: {
          success: false,
          message: 'Message content or attachment is required.',
        },
      };
    }

    const conversation = await this.collaborationConversationGateway.loadConversationForUser(
      dto.conversationId,
      dto.user,
    );
    const participantIds = getParticipantIds(conversation);
    const senderId = dto.user?._id;
    const preview = dto.content.slice(0, 280) || (dto.attachments?.length ? `📎 ${dto.attachments[0]?.label || 'Attachment'}` : '');

    const message = await this.collaborationConversationGateway.createMessage({
      conversationId: conversation._id,
      senderId,
      content: dto.content,
      attachments: dto.attachments,
    });

    await this.collaborationConversationGateway.updateConversationLastMessage({
      conversationId: conversation._id,
      lastMessageAt: message.createdAt,
      lastMessagePreview: preview,
      lastMessageBy: senderId,
    });

    const populatedMessage = await this.collaborationConversationGateway.getMessageById(message._id);

    this.collaborationRealtimeGateway.notifyMessage({
      io: dto.io,
      conversationId: conversation._id,
      participantIds,
      message: populatedMessage,
    });

    this.collaborationRealtimeGateway.notifyConversationUpdate({
      io: dto.io,
      participantIds,
      payload: {
        conversationId: toCollaborationIdString(conversation._id),
        lastMessageAt: message.createdAt,
        lastMessagePreview: preview,
        lastMessageBy: toCollaborationIdString(senderId),
      },
    });

    const normalizedSenderId = toCollaborationIdString(senderId);
    const recipientIds = participantIds.filter((participantId) => participantId !== normalizedSenderId);

    await Promise.all(
      recipientIds.map((recipientId) => this.collaborationNotificationGateway.createMessageNotification({
        recipientId,
        conversation: {
          _id: conversation._id,
          title: conversation.title,
          type: conversation.type,
        },
        sender: dto.user,
        content: dto.content,
      })),
    );

    // Mention notifications — high priority
    try {
      const mentionedUsernames = extractMentions(dto.content);
      if (mentionedUsernames.length > 0) {
        const resolved = await resolveMentions(mentionedUsernames, participantIds);
        for (const mention of resolved) {
          if (mention.userId === normalizedSenderId) continue;
          this.collaborationNotificationGateway.createMessageNotification({
            recipientId: mention.userId,
            conversation: {
              _id: conversation._id,
              title: `${dto.user?.displayName || 'Someone'} mentioned you`,
              type: conversation.type,
            },
            sender: dto.user,
            content: dto.content,
            priority: 'high',
          }).catch(() => null);
        }
      }
    } catch (e) {
      // Mention processing is best-effort
    }

    return {
      statusCode: 201,
      body: {
        success: true,
        data: populatedMessage,
      },
    };
  }
}
