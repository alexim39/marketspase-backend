import express from 'express';
import { GetPromotionById } from '../controllers/get-promotion-byid.controller.js'
import { GetUserPromotions } from '../controllers/get-a-user-promotion.controller.js'
import { submitProof } from '../controllers/submit-proof.controler.js'
import { downloadPromotion } from '../controllers/donwload-promotion.js'
import { proofUpload } from '../services/proof-upload.service.js';
import { GetAdminPromotions } from '../controllers/admin/get-promotions.controller.js'
import { getPromotionFraudSummaryController } from '../controllers/admin/get-promotion-fraud-summary.controller.js';
import { getPromotionFraudCasesController } from '../controllers/admin/get-promotion-fraud-cases.controller.js';
import { applyPromotionFraudActionController } from '../controllers/admin/apply-promotion-fraud-action.controller.js';
import { authenticate } from '../../../shared/middleware/auth.middleware.js';
import { requireAdmin } from '../../../shared/middleware/authorization.middleware.js';

const PromoterRouter = express.Router();

PromoterRouter.use(authenticate);


/**
 * @route POST /api/promotions/download
 * @description Allows a promoter to register for a campaign and download the media.
 * @access Private (Promoter only)
 */
PromoterRouter.post('/download', downloadPromotion);

/* Get Promotions for Admin view */
PromoterRouter.get('/admin/promotions', requireAdmin, GetAdminPromotions);
PromoterRouter.get('/admin/fraud/summary', requireAdmin, getPromotionFraudSummaryController);
PromoterRouter.get('/admin/fraud/cases', requireAdmin, getPromotionFraudCasesController);
PromoterRouter.post('/admin/fraud/cases/:caseId/action', requireAdmin, applyPromotionFraudActionController);

// Get a user promotions with filtering and pagination
PromoterRouter.get('/user/:userId', GetUserPromotions);

// POST /api/promotions/submit-proof
PromoterRouter.post('/submit-proof/:promoterId', proofUpload.array("proofImages", 3), submitProof);

// get promotion
PromoterRouter.get('/:id/:userId', GetPromotionById);

export default PromoterRouter;
