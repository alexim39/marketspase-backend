// routes/promotion.routes.js
import express from 'express';
import {
  createPromotion,
  getPromoterPromotions,
  getPromotionStats,
  getPromotionDashboard,
  trackClick
} from '../../../controllers/product/promotion/promotion.controller.js';

const router = express.Router();

router.post('/create', createPromotion);
router.get('/promoter', getPromoterPromotions);
router.get('/stats', getPromotionStats);
router.get('/dashboard', getPromotionDashboard);
router.get('/track/:uniqueCode', trackClick);

export default router;