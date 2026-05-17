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

const router = express.Router();

router.use(authenticate);

router.get("/conversations", listConversations);
router.post("/conversations/direct", createDirectConversation);
router.post("/conversations/campaign/:campaignId", openCampaignConversation);
router.post("/conversations/promotion/:promotionId", openPromotionConversation);
router.get("/conversations/:conversationId/messages", getConversationMessages);
router.post("/conversations/:conversationId/messages", sendConversationMessage);
router.patch("/conversations/:conversationId/read", markConversationRead);

router.get("/reviews/eligibility/:targetUserId", getReviewEligibilityController);
router.get("/reviews/received/:userId", getReceivedReviews);
router.get("/reviews/given/:userId", getGivenReviews);
router.post("/reviews", createReview);
router.post("/reviews/:reviewId/flag", flagReview);

router.get("/admin/reviews", requireAdmin, getAdminReviews);
router.patch("/admin/reviews/:reviewId", requireAdmin, moderateReview);

export default router;
