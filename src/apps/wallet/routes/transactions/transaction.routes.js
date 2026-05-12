import express from 'express';
import { getTransactionSummary } from '../../controllers/transactions/summary.controller.js';
import { authenticate } from '../../../../shared/middleware/auth.middleware.js';

const router = express.Router();

router.use(authenticate);

// Add this route
router.get('/summary', getTransactionSummary);

export default router;
