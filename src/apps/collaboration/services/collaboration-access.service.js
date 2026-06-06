import mongoose from "mongoose";
import { CampaignModel } from "../../campaign/models/index.js";
import { PromotionModel } from "../../promotion/models/index.js";
import { UserModel } from "../../user/models/user/index.js";
import { CollaborationConversationModel } from "../models/index.js";

const CAMPAIGN_ROOM_ACTIVE_STATUSES = new Set(["accepted"]);

export const toIdString = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value instanceof mongoose.Types.ObjectId) return value.toString();
  if (typeof value === "object" && typeof value.toHexString === "function") {
    return value.toHexString();
  }
  if (typeof value === "object" && value._id && value._id !== value) {
    return toIdString(value._id);
  }
  return String(value);
};

export const ensureObjectId = (value, fieldName = "identifier") => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    const error = new Error(`Invalid ${fieldName}.`);
    error.status = 400;
    throw error;
  }

  return new mongoose.Types.ObjectId(value);
};

export const isAdminActor = (user) => ["admin", "super-admin"].includes(user?.role);

export const assertConversationParticipant = (conversation, userId) => {
  const normalizedUserId = toIdString(userId);
  const isParticipant = Array.isArray(conversation?.participants)
    && conversation.participants.some((participant) => toIdString(participant.user) === normalizedUserId);

  if (!isParticipant) {
    const error = new Error("You are not allowed to access this conversation.");
    error.status = 403;
    throw error;
  }
};

export const loadConversationForUser = async (conversationId, user) => {
  const conversation = await CollaborationConversationModel.findById(conversationId)
    .populate("participants.user", "displayName username avatar role isVerified")
    .populate("campaign", "title status owner")
    .populate("promotion", "upi status promoter campaign")
    .lean();

  if (!conversation || conversation.isActive === false) {
    const error = new Error("Conversation not found.");
    error.status = 404;
    throw error;
  }

  if (!isAdminActor(user)) {
    assertConversationParticipant(conversation, user?._id);
  }

  return conversation;
};

export const getCampaignAccessSnapshot = async (campaignId) => {
  const normalizedCampaignId = ensureObjectId(campaignId, "campaign ID");
  const campaign = await CampaignModel.findById(normalizedCampaignId)
    .select("_id title owner status")
    .lean();

  if (!campaign) {
    const error = new Error("Campaign not found.");
    error.status = 404;
    throw error;
  }

  const promotions = await PromotionModel.find({
    campaign: campaign._id,
    status: { $in: Array.from(CAMPAIGN_ROOM_ACTIVE_STATUSES) },
  })
    .select("_id promoter status isActive campaign upi")
    .lean();

  return {
    campaign,
    promotions,
  };
};

export const syncCampaignConversationParticipants = async (conversationId, campaignId) => {
  const { campaign, promotions } = await getCampaignAccessSnapshot(campaignId);
  const uniqueParticipants = new Map();

  uniqueParticipants.set(toIdString(campaign.owner), {
    user: campaign.owner,
    role: "marketer",
  });

  for (const promotion of promotions) {
    const promoterId = toIdString(promotion.promoter);
    if (!promoterId) continue;

    uniqueParticipants.set(promoterId, {
      user: promotion.promoter,
      role: "promoter",
    });
  }

  const participants = Array.from(uniqueParticipants.values());

  await CollaborationConversationModel.updateOne(
    { _id: conversationId },
    { $set: { participants } }
  );

  return participants;
};

export const getOrCreateCampaignConversation = async ({ campaignId, actor }) => {
  const { campaign, promotions } = await getCampaignAccessSnapshot(campaignId);
  const actorId = toIdString(actor?._id);
  const isOwner = actorId === toIdString(campaign.owner);
  const isPromoter = promotions.some((promotion) => actorId === toIdString(promotion.promoter));

  if (!isAdminActor(actor) && !isOwner && !isPromoter) {
    const error = new Error("You are not allowed to open this campaign collaboration room.");
    error.status = 403;
    throw error;
  }

  let conversation = await CollaborationConversationModel.findOne({
    campaign: campaign._id,
    type: "campaign_room",
    isArchived: false,
    isActive: true,
  });

  if (!conversation) {
    const participants = [];
    const uniqueParticipants = new Map();
    uniqueParticipants.set(toIdString(campaign.owner), { user: campaign.owner, role: "marketer" });

    for (const promotion of promotions) {
      uniqueParticipants.set(toIdString(promotion.promoter), { user: promotion.promoter, role: "promoter" });
    }

    conversation = await CollaborationConversationModel.create({
      type: "campaign_room",
      title: `${campaign.title} collaboration`,
      participants: Array.from(uniqueParticipants.values()),
      campaign: campaign._id,
      createdBy: actor._id,
      metadata: {
        entityType: "campaign",
        entityId: toIdString(campaign._id),
        entityLabel: campaign.title,
      },
    });
  } else {
    await syncCampaignConversationParticipants(conversation._id, campaign._id);
  }

  return CollaborationConversationModel.findById(conversation._id)
    .populate("participants.user", "displayName username avatar role isVerified")
    .populate("campaign", "title status owner")
    .lean();
};

export const getPromotionAccessSnapshot = async (promotionId) => {
  const normalizedPromotionId = ensureObjectId(promotionId, "promotion ID");
  const promotion = await PromotionModel.findById(normalizedPromotionId)
    .select("_id promoter campaign status upi isActive clickStats")
    .lean();

  if (!promotion) {
    const error = new Error("Promotion not found.");
    error.status = 404;
    throw error;
  }

  const campaign = await CampaignModel.findById(promotion.campaign)
    .select("_id owner title status")
    .lean();

  if (!campaign) {
    const error = new Error("Campaign not found.");
    error.status = 404;
    throw error;
  }

  return { promotion, campaign };
};

export const getOrCreatePromotionConversation = async ({ promotionId, actor }) => {
  const { promotion, campaign } = await getPromotionAccessSnapshot(promotionId);
  const actorId = toIdString(actor?._id);
  const promoterId = toIdString(promotion.promoter);
  const marketerId = toIdString(campaign.owner);

  if (!isAdminActor(actor) && actorId !== promoterId && actorId !== marketerId) {
    const error = new Error("You are not allowed to open this promotion conversation.");
    error.status = 403;
    throw error;
  }

  let conversation = await CollaborationConversationModel.findOne({
    promotion: promotion._id,
    type: "promotion_room",
    isArchived: false,
    isActive: true,
  });

  if (!conversation) {
    conversation = await CollaborationConversationModel.create({
      type: "promotion_room",
      title: `${campaign.title} direct support`,
      participants: [
        { user: campaign.owner, role: "marketer" },
        { user: promotion.promoter, role: "promoter" },
      ],
      campaign: campaign._id,
      promotion: promotion._id,
      createdBy: actor._id,
      metadata: {
        entityType: "promotion",
        entityId: toIdString(promotion._id),
        entityLabel: campaign.title,
      },
    });
  }

  return CollaborationConversationModel.findById(conversation._id)
    .populate("participants.user", "displayName username avatar role isVerified")
    .populate("campaign", "title status owner")
    .populate("promotion", "upi status promoter campaign")
    .lean();
};

export const getOrCreateDirectConversation = async ({ actor, targetUserId, campaignId = null, promotionId = null }) => {
  const normalizedTargetUserId = ensureObjectId(targetUserId, "target user ID");
  const actorId = ensureObjectId(actor?._id, "actor ID");

  if (toIdString(normalizedTargetUserId) === toIdString(actorId)) {
    const error = new Error("You cannot start a direct conversation with yourself.");
    error.status = 400;
    throw error;
  }

  const targetUser = await UserModel.findById(normalizedTargetUserId)
    .select("_id displayName username avatar role isVerified")
    .lean();

  if (!targetUser) {
    const error = new Error("Target user not found.");
    error.status = 404;
    throw error;
  }

  if (promotionId) {
    const { promotion, campaign } = await getPromotionAccessSnapshot(promotionId);
    const participantIds = new Set([
      toIdString(actorId),
      toIdString(normalizedTargetUserId),
    ]);
    const allowedIds = new Set([toIdString(promotion.promoter), toIdString(campaign.owner)]);

    if (![...participantIds].every((id) => allowedIds.has(id))) {
      const error = new Error("This direct conversation must stay between the linked promoter and marketer.");
      error.status = 403;
      throw error;
    }
  }

  const existingConversations = await CollaborationConversationModel.find({
    type: promotionId ? "promotion_room" : "direct",
    isArchived: false,
    isActive: true,
    ...(promotionId ? { promotion: promotionId } : {}),
    "participants.user": { $all: [actorId, normalizedTargetUserId] },
  })
    .select("_id participants")
    .lean();

  const existing = existingConversations.find((conversation) => (conversation.participants || []).length === 2);

  if (existing) {
    return CollaborationConversationModel.findById(existing._id)
      .populate("participants.user", "displayName username avatar role isVerified")
      .populate("campaign", "title status owner")
      .populate("promotion", "upi status promoter campaign")
      .lean();
  }

  const conversation = await CollaborationConversationModel.create({
    type: promotionId ? "promotion_room" : "direct",
    title: promotionId ? `${targetUser.displayName || targetUser.username} support` : "",
    participants: [
      { user: actorId, role: actor.role || "user" },
      { user: normalizedTargetUserId, role: targetUser.role || "user" },
    ],
    campaign: campaignId || null,
    promotion: promotionId || null,
    createdBy: actorId,
    metadata: promotionId
      ? {
          entityType: "promotion",
          entityId: String(promotionId),
          entityLabel: "Promotion collaboration",
        }
      : {},
  });

  return CollaborationConversationModel.findById(conversation._id)
    .populate("participants.user", "displayName username avatar role isVerified")
    .populate("campaign", "title status owner")
    .populate("promotion", "upi status promoter campaign")
    .lean();
};
