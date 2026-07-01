import express from 'express';
import { handleCopilotMessage } from '../controllers/copilot.controller.js';
import { authenticate } from '../../../shared/middleware/auth.middleware.js';

const router = express.Router();
router.use(authenticate);
router.post('/message', handleCopilotMessage);

export default router;
