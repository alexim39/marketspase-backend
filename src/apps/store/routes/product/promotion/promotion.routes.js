// routes/promotion.routes.js
import express from 'express';
import {
  getPromoterPromotions,
  getPromotionStats,
  getPromotionDashboard,
} from '../../../controllers/promotion/promotion.controller.js';

import { createPromotion } from '../../../controllers/promotion/create-promotion.controller.js'

import {
  trackProductView,
  trackClick,
  getPromotionPerformance
} from '../../../controllers/promotion/product-tracking.controller.js';


const router = express.Router();

router.post('/create', createPromotion);
router.get('/promoter', getPromoterPromotions);
router.get('/stats', getPromotionStats);
router.get('/dashboard', getPromotionDashboard);



// Tracking endpoints
router.post('/:productId/track-view', trackProductView);
router.get('/track/:uniqueCode', trackClick);
router.get('/:productId/promotion-performance', getPromotionPerformance);

export default router;