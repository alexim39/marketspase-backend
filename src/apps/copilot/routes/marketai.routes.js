import express from 'express';
import { handleMarketAiMessage } from '../controllers/marketai.controller.js';
import { authenticate } from '../../../shared/middleware/auth.middleware.js';

const router = express.Router();
router.use(authenticate);
router.post('/message', handleMarketAiMessage);

export default router;
