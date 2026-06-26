// routes/promotion.routes.js
import express from 'express';
//import { getPromotionStats } from '../../../controllers/promotion/get-promotion-stats.controller.js';
import { getPromotionDashboard } from '../../../controllers/promotion/get-promotion-dashboard.controller.js'
import { getPromoterPromotions } from '../../../controllers/promotion/get-promoter-promotions.controller.js'
import { createPromotion } from '../../../controllers/promotion/create-promotion.controller.js'
import { authenticate } from '../../../../../shared/middleware/auth.middleware.js';
import {
  discoverPromoters,
  invitePromoterToPromote,
} from '../../../controllers/promotion/discover-promoters.controller.js';
import { getLandingPage } from '../../../controllers/promotion/landing-page.controller.js';
import { getStorePromoterDashboard } from '../../../controllers/promotion/promoter-dashboard.controller.js';

import {
  trackProductView,
  trackClick,
} from '../../../controllers/promotion/product-tracking.controller.js';

const router = express.Router();

router.post('/create', authenticate, createPromotion);
router.get('/promoter', authenticate, getPromoterPromotions);
//router.get('/stats', getPromotionStats);
router.get('/dashboard', authenticate, getPromotionDashboard);

// Promoter discovery
router.get('/promoters/discover', authenticate, discoverPromoters);
router.post('/promoters/:promoterId/invite-to-promote', authenticate, invitePromoterToPromote);

// Landing page (public)
router.get('/landing/:trackingCode', getLandingPage);

// Promoter dashboard widget (lightweight overview)
router.get('/overview', authenticate, getStorePromoterDashboard);

// Tracking endpoints
router.post('/:productId/track-view', trackProductView);
router.get('/track-click/:uniqueCode', trackClick);
router.post('/track-click/:uniqueCode', trackClick);
//router.get('/:productId/promotion-performance', getPromotionPerformance);

export default router;
