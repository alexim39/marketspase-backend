import express from 'express';
import { getTransactionSummary } from '../../controllers/transactions/summary.controller.js';

const router = express.Router();


// Add this route
router.get('/summary', getTransactionSummary);

export default router;