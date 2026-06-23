import express from "express";
import { authenticate } from "../../../shared/middleware/auth.middleware.js";
import { requireAdmin } from "../../../shared/middleware/authorization.middleware.js";
import {
  createDirectConversation,
  getConversationMessages,
  listConversations,
  markConversationRead,
  openCampaignConversation,
  openPromotionConversation,
  sendConversationMessage,
} from "../controllers/conversation.controller.js";
import {
  createReview,
  flagReview,
  getAdminReviews,
  getGivenReviews,
  getReceivedReviews,
  getReviewEligibilityController,
  moderateReview,
} from "../controllers/review.controller.js";
import { CollaborationConversationModel, CollaborationMessageModel } from "../models/index.js";
import { presenceTracker } from "../services/presence-tracker.js";
import { messageSendLimiter } from "../../../shared/middleware/rate-limit.middleware.js";

const router = express.Router();

router.use(authenticate);

router.get("/conversations", listConversations);
router.post("/conversations/direct", createDirectConversation);
router.post("/conversations/campaign/:campaignId", openCampaignConversation);
router.post("/conversations/promotion/:promotionId", openPromotionConversation);
router.get("/conversations/:conversationId/messages", getConversationMessages);
router.post("/conversations/:conversationId/messages", messageSendLimiter, sendConversationMessage);
router.patch("/conversations/:conversationId/read", markConversationRead);

// Pin / unpin a message
router.patch("/conversations/:conversationId/messages/:messageId/pin", async (req, res) => {
  try {
    const { conversationId, messageId } = req.params;
    const conv = await CollaborationConversationModel.findOne({
      _id: conversationId,
      'participants.user': req.userId,
      isActive: true,
    });
    if (!conv) return res.status(403).json({ success: false, message: 'Access denied.' });

    const message = await CollaborationMessageModel.findOneAndUpdate(
      { _id: messageId, conversation: conversationId, deletedAt: null },
      { $set: { isPinned: true } },
      { new: true }
    ).populate('sender', 'displayName username avatar role isVerified').lean();

    if (!message) return res.status(404).json({ success: false, message: 'Message not found.' });

    await CollaborationConversationModel.updateOne(
      { _id: conversationId },
      { $addToSet: { pinnedMessages: messageId } }
    );

    return res.json({ success: true, data: message });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

router.patch("/conversations/:conversationId/messages/:messageId/unpin", async (req, res) => {
  try {
    const { conversationId, messageId } = req.params;
    const conv = await CollaborationConversationModel.findOne({
      _id: conversationId,
      'participants.user': req.userId,
      isActive: true,
    });
    if (!conv) return res.status(403).json({ success: false, message: 'Access denied.' });

    await CollaborationMessageModel.updateOne(
      { _id: messageId, conversation: conversationId },
      { $set: { isPinned: false } }
    );

    await CollaborationConversationModel.updateOne(
      { _id: conversationId },
      { $pull: { pinnedMessages: messageId } }
    );

    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// Presence — check if a user is online
router.get("/presence/:userId", (req, res) => {
  try {
    const online = presenceTracker.isOnline(req.params.userId);
    return res.json({ success: true, data: { online } });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// Unread count — total unread messages across all conversations for current user
router.get("/unread-count", async (req, res) => {
  try {
    const userId = req.userId;
    const conversations = await CollaborationConversationModel.find({
      'participants.user': userId,
      isActive: true,
      lastMessageAt: { $exists: true },
    })
      .select('participants lastMessageBy')
      .lean();

    let total = 0;
    for (const conv of conversations) {
      const participant = conv.participants?.find(
        (p) => p.user?.toString() === userId
      );
      if (!participant) continue;

      const lastReadAt = participant.lastReadAt
        ? new Date(participant.lastReadAt).getTime()
        : 0;
      const lastMsgBy = conv.lastMessageBy?.toString();
      if (lastMsgBy && lastMsgBy !== userId && conv.lastMessageAt) {
        const lastMsgAt = new Date(conv.lastMessageAt).getTime();
        if (lastMsgAt > lastReadAt) total += 1;
      }
    }

    return res.json({ success: true, data: { unreadCount: total } });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// Dashboard — recent conversations with previews for the current user
router.get("/dashboard", async (req, res) => {
  try {
    const userId = req.userId;
    const conversations = await CollaborationConversationModel.find({
      'participants.user': userId,
      isActive: true,
      lastMessageAt: { $exists: true },
    })
      .sort({ lastMessageAt: -1 })
      .limit(5)
      .populate('campaign', 'title')
      .populate('promotion', 'upi')
      .populate('lastMessageBy', 'displayName username avatar')
      .lean();

    const shaped = conversations.map((conv) => {
      const participant = (conv.participants || []).find(
        (p) => p.user?.toString() === userId
      );
      const lastReadAt = participant?.lastReadAt
        ? new Date(participant.lastReadAt).getTime()
        : 0;
      const lastMsgAt = conv.lastMessageAt ? new Date(conv.lastMessageAt).getTime() : 0;
      const isUnread = lastMsgAt > lastReadAt && conv.lastMessageBy?.toString() !== userId;

      return {
        _id: conv._id,
        type: conv.type,
        title: conv.title || conv.campaign?.title || conv.promotion?.upi || 'Conversation',
        lastMessagePreview: conv.lastMessagePreview,
        lastMessageBy: conv.lastMessageBy
          ? { displayName: conv.lastMessageBy.displayName, username: conv.lastMessageBy.username, avatar: conv.lastMessageBy.avatar }
          : null,
        lastMessageAt: conv.lastMessageAt,
        isUnread,
        campaignId: conv.campaign?._id || null,
        promotionId: conv.promotion?._id || null,
      };
    });

    return res.json({ success: true, data: { conversations: shaped } });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// Suggestions — suggested contacts for the current user
router.get("/suggestions", async (req, res) => {
  try {
    const userId = req.userId;
    const oid = new (require('mongoose').Types.ObjectId)(userId);

    // Find existing conversation partners
    const existingConversations = await CollaborationConversationModel.find({
      'participants.user': oid,
      isActive: true,
    })
      .select('participants.user type campaign promotion')
      .lean();

    const existingPartnerIds = new Set();
    for (const conv of existingConversations) {
      for (const p of conv.participants || []) {
        const pid = p.user?.toString();
        if (pid && pid !== userId) existingPartnerIds.add(pid);
      }
    }

    // Find users who share campaigns or promotions with the current user
    const { CampaignModel } = await import('../../campaign/models/campaign.model.js');
    const { PromotionModel } = await import('../../promotion/models/index.js');

    const [ownedCampaigns, userPromotions] = await Promise.all([
      CampaignModel.find({ owner: oid }).select('_id').lean(),
      PromotionModel.find({ promoter: oid }).select('_id campaign').lean(),
    ]);

    const ownedCampaignIds = ownedCampaigns.map((c) => c._id);
    const promotedCampaignIds = userPromotions.map((p) => p.campaign);

    // Find promoters of the marketer's campaigns
    const suggestions = [];
    const seen = new Set(existingPartnerIds);

    if (ownedCampaignIds.length > 0) {
      const campaignPromoters = await PromotionModel.find({
        campaign: { $in: ownedCampaignIds },
        promoter: { $ne: oid, $nin: Array.from(seen) },
        isActive: true,
      })
        .select('promoter campaign')
        .populate('promoter', 'displayName username avatar role')
        .limit(5)
        .lean();

      for (const promo of campaignPromoters) {
        const pid = promo.promoter?._id?.toString();
        if (!pid || seen.has(pid)) continue;
        seen.add(pid);
        suggestions.push({
          userId: pid,
          displayName: promo.promoter?.displayName,
          username: promo.promoter?.username,
          avatar: promo.promoter?.avatar,
          reason: 'Promotes your campaign',
        });
      }
    }

    // Find marketers of campaigns the user promotes (for promoter users)
    if (promotedCampaignIds.length > 0 && suggestions.length < 5) {
      const marketers = await CampaignModel.find({
        _id: { $in: promotedCampaignIds },
        owner: { $ne: oid, $nin: Array.from(seen) },
      })
        .select('owner')
        .populate('owner', 'displayName username avatar role')
        .limit(5)
        .lean();

      for (const campaign of marketers) {
        const mid = campaign.owner?._id?.toString();
        if (!mid || seen.has(mid)) continue;
        seen.add(mid);
        suggestions.push({
          userId: mid,
          displayName: campaign.owner?.displayName,
          username: campaign.owner?.username,
          avatar: campaign.owner?.avatar,
          reason: 'Your campaign marketer',
        });
      }
    }

    return res.json({ success: true, data: { suggestions: suggestions.slice(0, 5) } });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

router.get("/reviews/eligibility/:targetUserId", getReviewEligibilityController);
router.get("/reviews/received/:userId", getReceivedReviews);
router.get("/reviews/given/:userId", getGivenReviews);
router.post("/reviews", createReview);
router.post("/reviews/:reviewId/flag", flagReview);

router.get("/admin/reviews", requireAdmin, getAdminReviews);
router.patch("/admin/reviews/:reviewId", requireAdmin, moderateReview);

export default router;
