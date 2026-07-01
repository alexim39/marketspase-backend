import express from 'express';
import { getUnifiedAnalytics } from '../controllers/unified-analytics.controller.js';
import { authenticate } from '../../../shared/middleware/auth.middleware.js';

const router = express.Router();
router.use(authenticate);
router.get('/unified', getUnifiedAnalytics);

export default router;
