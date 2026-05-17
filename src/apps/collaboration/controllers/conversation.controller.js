import mongoose from "mongoose";
import { NotificationService } from "../../notification/services/notification.service.js";
import { CollaborationConversationModel, CollaborationMessageModel } from "../models/index.js";
import {
  getOrCreateCampaignConversation,
  getOrCreateDirectConversation,
  getOrCreatePromotionConversation,
  loadConversationForUser,
  toIdString,
} from "../services/collaboration-access.service.js";
import {
  notifyCollaborationConversationUpdate,
  notifyCollaborationMessage,
} from "../../ai-assistant/socket.handler.js";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const parseLimit = (value, fallback = DEFAULT_LIMIT) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, MAX_LIMIT);
};

const serializeConversation = async (conversation, currentUserId) => {
  const normalizedCurrentUserId = toIdString(currentUserId);
  const counterpart = (conversation.participants || [])
    .map((participant) => participant.user)
    .find((participant) => toIdString(participant?._id) !== normalizedCurrentUserId) || null;

  const unreadCount = await CollaborationMessageModel.countDocuments({
    conversation: conversation._id,
    sender: { $ne: currentUserId },
    deletedAt: null,
    readBy: { $not: { $elemMatch: { user: currentUserId } } },
  });

  return {
    _id: conversation._id,
    type: conversation.type,
    title: conversation.title,
    participants: (conversation.participants || []).map((participant) => ({
      user: participant.user,
      role: participant.role,
    })),
    counterpart,
    campaign: conversation.campaign
      ? {
          _id: conversation.campaign._id,
          title: conversation.campaign.title,
          status: conversation.campaign.status,
        }
      : null,
    promotion: conversation.promotion
      ? {
          _id: conversation.promotion._id,
          upi: conversation.promotion.upi,
          status: conversation.promotion.status,
        }
      : null,
    metadata: conversation.metadata || {},
    lastMessageAt: conversation.lastMessageAt,
    lastMessagePreview: conversation.lastMessagePreview || "",
    lastMessageBy: conversation.lastMessageBy || null,
    unreadCount,
    isArchived: conversation.isArchived,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
};

export const listConversations = async (req, res) => {
  try {
    const currentUserId = req.user?._id;
    const kind = String(req.query.kind || "all");
    const search = String(req.query.search || "").trim().toLowerCase();
    const limit = parseLimit(req.query.limit, 25);

    const query = {
      isActive: true,
      isArchived: false,
      "participants.user": currentUserId,
    };

    if (kind !== "all") {
      query.type = kind;
    }

    const conversations = await CollaborationConversationModel.find(query)
      .populate("participants.user", "displayName username avatar role isVerified")
      .populate("campaign", "title status owner")
      .populate("promotion", "upi status promoter campaign")
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .limit(limit)
      .lean();

    const filteredConversations = search
      ? conversations.filter((conversation) => {
          const participantText = (conversation.participants || [])
            .map((participant) => `${participant.user?.displayName || ""} ${participant.user?.username || ""}`)
            .join(" ")
            .toLowerCase();
          const haystack = [
            conversation.title || "",
            conversation.lastMessagePreview || "",
            conversation.campaign?.title || "",
            conversation.metadata?.entityLabel || "",
            participantText,
          ].join(" ").toLowerCase();

          return haystack.includes(search);
        })
      : conversations;

    const serialized = await Promise.all(
      filteredConversations.map((conversation) => serializeConversation(conversation, currentUserId))
    );

    return res.json({
      success: true,
      data: serialized,
    });
  } catch (error) {
    console.error("List collaboration conversations error:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to load collaboration conversations.",
    });
  }
};

export const createDirectConversation = async (req, res) => {
  try {
    const { targetUserId, campaignId = null, promotionId = null } = req.body || {};
    const conversation = await getOrCreateDirectConversation({
      actor: req.user,
      targetUserId,
      campaignId,
      promotionId,
    });

    return res.status(201).json({
      success: true,
      data: await serializeConversation(conversation, req.user?._id),
    });
  } catch (error) {
    console.error("Create direct collaboration conversation error:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to start this conversation.",
    });
  }
};

export const openCampaignConversation = async (req, res) => {
  try {
    const conversation = await getOrCreateCampaignConversation({
      campaignId: req.params.campaignId,
      actor: req.user,
    });

    return res.json({
      success: true,
      data: await serializeConversation(conversation, req.user?._id),
    });
  } catch (error) {
    console.error("Open campaign collaboration room error:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to open this campaign room.",
    });
  }
};

export const openPromotionConversation = async (req, res) => {
  try {
    const conversation = await getOrCreatePromotionConversation({
      promotionId: req.params.promotionId,
      actor: req.user,
    });

    return res.json({
      success: true,
      data: await serializeConversation(conversation, req.user?._id),
    });
  } catch (error) {
    console.error("Open promotion collaboration room error:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to open this promotion room.",
    });
  }
};

export const getConversationMessages = async (req, res) => {
  try {
    const conversation = await loadConversationForUser(req.params.conversationId, req.user);
    const limit = parseLimit(req.query.limit, DEFAULT_LIMIT);
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      CollaborationMessageModel.find({
        conversation: conversation._id,
        deletedAt: null,
      })
        .populate("sender", "displayName username avatar role isVerified")
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CollaborationMessageModel.countDocuments({
        conversation: conversation._id,
        deletedAt: null,
      }),
    ]);

    return res.json({
      success: true,
      data: {
        conversation: await serializeConversation(conversation, req.user?._id),
        messages,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(Math.ceil(total / limit), 1),
        },
      },
    });
  } catch (error) {
    console.error("Get collaboration messages error:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to load messages.",
    });
  }
};

export const sendConversationMessage = async (req, res) => {
  try {
    const content = String(req.body?.content || "").trim();
    const attachments = Array.isArray(req.body?.attachments) ? req.body.attachments : [];

    if (!content) {
      return res.status(400).json({
        success: false,
        message: "Message content is required.",
      });
    }

    const conversation = await loadConversationForUser(req.params.conversationId, req.user);
    const participantIds = (conversation.participants || [])
      .map((participant) => toIdString(participant.user?._id || participant.user))
      .filter(Boolean);

    const message = await CollaborationMessageModel.create({
      conversation: conversation._id,
      sender: req.user._id,
      content,
      attachments,
      readBy: [{ user: req.user._id, readAt: new Date() }],
    });

    await CollaborationConversationModel.updateOne(
      { _id: conversation._id },
      {
        $set: {
          lastMessageAt: message.createdAt,
          lastMessagePreview: content.slice(0, 280),
          lastMessageBy: req.user._id,
        },
      }
    );

    const populatedMessage = await CollaborationMessageModel.findById(message._id)
      .populate("sender", "displayName username avatar role isVerified")
      .lean();

    const io = req.app.get("io");
    if (io) {
      notifyCollaborationMessage(io, conversation._id, participantIds, populatedMessage);
      notifyCollaborationConversationUpdate(io, participantIds, {
        conversationId: toIdString(conversation._id),
        lastMessageAt: message.createdAt,
        lastMessagePreview: content.slice(0, 280),
        lastMessageBy: toIdString(req.user._id),
      });
    }

    const recipientIds = participantIds.filter((id) => id !== toIdString(req.user._id));
    await Promise.all(
      recipientIds.map((recipientId) =>
        NotificationService.createCollaborationMessageNotification(
          recipientId,
          {
            _id: conversation._id,
            title: conversation.title,
            type: conversation.type,
          },
          req.user,
          content
        )
      )
    );

    return res.status(201).json({
      success: true,
      data: populatedMessage,
    });
  } catch (error) {
    console.error("Send collaboration message error:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to send this message.",
    });
  }
};

export const markConversationRead = async (req, res) => {
  try {
    const conversation = await loadConversationForUser(req.params.conversationId, req.user);

    await CollaborationMessageModel.updateMany(
      {
        conversation: conversation._id,
        sender: { $ne: req.user._id },
        deletedAt: null,
        readBy: { $not: { $elemMatch: { user: req.user._id } } },
      },
      {
        $push: {
          readBy: {
            user: req.user._id,
            readAt: new Date(),
          },
        },
      }
    );

    return res.json({
      success: true,
      message: "Conversation marked as read.",
    });
  } catch (error) {
    console.error("Mark collaboration conversation read error:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to mark this conversation as read.",
    });
  }
};
