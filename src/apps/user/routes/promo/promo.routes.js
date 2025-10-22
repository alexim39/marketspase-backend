// routes/promo.routes.js
import express from 'express';
import { PromoController } from './../../controllers/promo/promo.controller.js';

const PromoRouter = express.Router();

// Get active promo for current user's role
PromoRouter.get('/active', PromoController.getActivePromo);

// Check eligibility for specific promo
PromoRouter.get('/:promoId/eligibility/:userId', PromoController.checkEligibility);

// Claim promo credit
PromoRouter.post('/claim', PromoController.claimPromoCredit);

// Get user's promo claims history
PromoRouter.get('/claims/history', PromoController.getMyPromoClaims);

export default PromoRouter;