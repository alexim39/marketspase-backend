import express from 'express';
import { 
    getPromotionById
} from '../controllers/promotion.controller.js'

const PromoterRouter = express.Router();

// get promotion
PromoterRouter.get('/:id/:userId', getPromotionById);

// confirm payment
//TransactionRouter.post('/withdraw-request', withdrawRequest);

// confirm payment
//TransactionRouter.delete('/saved-accounts/:userId/:accountId', deleteSavedAccount);

export default PromoterRouter;