import { CollaborationConversationModel, CollaborationMessageModel } from '../../models/index.js';
import {
  getOrCreateCampaignConversation,
  getOrCreateDirectConversation,
  getOrCreatePromotionConversation,
  loadConversationForUser,
} from '../../services/collaboration-access.service.js';
import { CollaborationConversationGateway } from '../../application/ports/collaboration-conversation.gateway.js';
import { toCollaborationIdString } from '../../application/mappers/collaboration-conversation.mapper.js';

export class MongooseCollaborationConversationGateway extends CollaborationConversationGateway {
  async listConversations({ userId, kind = 'all', limit = 25 } = {}) {
    const query = {
      isActive: true,
      isArchived: false,
      'participants.user': userId,
    };

    if (kind !== 'all') {
      query.type = kind;
    }

    return CollaborationConversationModel.find(query)
      .select('type title participants campaign promotion metadata lastMessageAt lastMessagePreview lastMessageBy isArchived createdAt updatedAt')
      .populate('participants.user', 'displayName username avatar role isVerified')
      .populate('campaign', 'title status')
      .populate('promotion', 'upi status')
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .limit(limit)
      .lean();
  }

  async getUnreadCounts({ conversationIds = [], userId } = {}) {
    if (!conversationIds.length) {
      return new Map();
    }

    const unreadCounts = await CollaborationMessageModel.aggregate([
      {
        $match: {
          conversation: { $in: conversationIds },
          deletedAt: null,
          sender: { $ne: userId },
          readBy: {
            $not: {
              $elemMatch: { user: userId },
            },
          },
        },
      },
      {
        $group: {
          _id: '$conversation',
          count: { $sum: 1 },
        },
      },
    ]);

    return new Map(
      unreadCounts.map((entry) => [toCollaborationIdString(entry._id), Number(entry.count || 0)]),
    );
  }

  async loadConversationForUser(conversationId, user) {
    return loadConversationForUser(conversationId, user);
  }

  async createDirectConversation({ actor, targetUserId, campaignId = null, promotionId = null } = {}) {
    return getOrCreateDirectConversation({
      actor,
      targetUserId,
      campaignId,
      promotionId,
    });
  }

  async openCampaignConversation({ actor, campaignId } = {}) {
    return getOrCreateCampaignConversation({
      actor,
      campaignId,
    });
  }

  async openPromotionConversation({ actor, promotionId } = {}) {
    return getOrCreatePromotionConversation({
      actor,
      promotionId,
    });
  }

  async listMessages({ conversationId, page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      CollaborationMessageModel.find({
        conversation: conversationId,
        deletedAt: null,
      })
        .populate('sender', 'displayName username avatar role isVerified')
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CollaborationMessageModel.countDocuments({
        conversation: conversationId,
        deletedAt: null,
      }),
    ]);

    return {
      messages,
      total,
    };
  }

  async createMessage({ conversationId, senderId, content, attachments = [] } = {}) {
    return CollaborationMessageModel.create({
      conversation: conversationId,
      sender: senderId,
      content,
      attachments,
      readBy: [{ user: senderId, readAt: new Date() }],
    });
  }

  async updateConversationLastMessage({
    conversationId,
    lastMessageAt,
    lastMessagePreview,
    lastMessageBy,
  } = {}) {
    return CollaborationConversationModel.updateOne(
      { _id: conversationId },
      {
        $set: {
          lastMessageAt,
          lastMessagePreview,
          lastMessageBy,
        },
      },
    );
  }

  async getMessageById(messageId) {
    return CollaborationMessageModel.findById(messageId)
      .populate('sender', 'displayName username avatar role isVerified')
      .lean();
  }

  async markConversationRead({ conversationId, userId } = {}) {
    return CollaborationMessageModel.updateMany(
      {
        conversation: conversationId,
        sender: { $ne: userId },
        deletedAt: null,
        readBy: { $not: { $elemMatch: { user: userId } } },
      },
      {
        $push: {
          readBy: {
            user: userId,
            readAt: new Date(),
          },
        },
      },
    );
  }
}
