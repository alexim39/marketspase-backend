import express from 'express';
import { GetPromotionById } from '../controllers/get-promotion-byid.controller.js'
import { GetUserPromotions } from '../controllers/get-a-user-promotion.controller.js'
import { submitProof } from '../controllers/submit-proof.controler.js'
import { downloadPromotion } from '../controllers/donwload-promotion.js'
import { proofUpload } from '../../../services/proof-upload.service.js';

const PromoterRouter = express.Router();

// Get a user promotions with filtering and pagination
PromoterRouter.get('/user/:userId', GetUserPromotions);

// get promotion
PromoterRouter.get('/:id/:userId', GetPromotionById);
/**
 * @route POST /api/promotions/download
 * @description Allows a promoter to register for a campaign and download the media.
 * @access Private (Promoter only)
 */
PromoterRouter.post('/download', downloadPromotion);
// POST /api/promotions/submit-proof
PromoterRouter.post('/submit-proof/:promoterId', proofUpload.array("proofImages", 3), submitProof);


export default PromoterRouter;