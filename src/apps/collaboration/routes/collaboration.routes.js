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
import multer from "multer";

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

// Toggle message reaction
router.patch("/conversations/:conversationId/messages/:messageId/react", async (req, res) => {
  try {
    const { conversationId, messageId } = req.params;
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ success: false, message: 'Emoji is required.' });

    const conv = await CollaborationConversationModel.findOne({
      _id: conversationId,
      'participants.user': req.userId,
      isActive: true,
    });
    if (!conv) return res.status(403).json({ success: false, message: 'Access denied.' });

    const message = await CollaborationMessageModel.findOne({
      _id: messageId,
      conversation: conversationId,
      deletedAt: null,
    });
    if (!message) return res.status(404).json({ success: false, message: 'Message not found.' });

    const existingIndex = (message.reactions || []).findIndex(
      (r) => r.emoji === emoji && r.user.toString() === req.userId,
    );

    if (existingIndex > -1) {
      message.reactions.splice(existingIndex, 1);
    } else {
      message.reactions.push({ emoji, user: req.userId });
    }

    await message.save();
    return res.json({ success: true, data: { _id: message._id, reactions: message.reactions } });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// Upload attachment for a conversation message
const attachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('File type not allowed.'));
  },
});

router.post("/conversations/:conversationId/attachments", attachmentUpload.single('file'), async (req, res) => {
  try {
    const { conversationId } = req.params;
    const conv = await CollaborationConversationModel.findOne({
      _id: conversationId,
      'participants.user': req.userId,
      isActive: true,
    });
    if (!conv) return res.status(403).json({ success: false, message: 'Access denied.' });

    const file = req.file;
    if (!file) return res.status(400).json({ success: false, message: 'No file provided.' });

    const ext = file.originalname.split('.').pop()?.toLowerCase();
    const allowedTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx'];
    if (!allowedTypes.includes(ext)) {
      return res.status(400).json({ success: false, message: 'File type not allowed. Allowed: jpg, jpeg, png, gif, webp, pdf, doc, docx' });
    }

    if (file.size > 10 * 1024 * 1024) {
      return res.status(400).json({ success: false, message: 'File too large (max 10MB).' });
    }

    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
    const kind = isImage ? 'image' : 'file';

    const result = await new Promise(async (resolve, reject) => {
      const cloudinary = await import('cloudinary');
      cloudinary.v2.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });
      const stream = cloudinary.v2.uploader.upload_stream(
        { folder: 'collaboration-attachments', resource_type: isImage ? 'image' : 'raw' },
        (error, result) => error ? reject(error) : resolve(result),
      );
      stream.end(file.buffer);
    });

    return res.json({ success: true, data: { url: result.secure_url, kind, label: file.originalname } });
  } catch (e) {
    console.error('Attachment upload error:', e);
    return res.status(500).json({ success: false, message: 'Upload failed.' });
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
