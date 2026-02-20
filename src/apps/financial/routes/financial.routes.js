// admin-financial.routes.js
import express from 'express';
import {
  getFinancialOverview,
  getFinancialStats,
  exportTransactions,
  exportWithdrawals
} from '../controllers/financial.controller.js';
import { getWithdrawalRequests } from '../controllers/get-withdrawal-request.controller.js';
import { approveWithdrawal } from '../controllers/approve-withdrawal.controller.js';
import { getTransactions } from '../controllers/get-transansactions.controller.js';
import { rejectWithdrawal } from '../controllers/reject-withdrawal.controller.js';
import { processWithdrawal } from '../controllers/process-withdrawal.controller.js';
import { getWithdrawalById } from '../controllers/get-withdrawal-by-id.controller.js';

const router = express.Router();

// Financial overview and stats
router.get('/overview', getFinancialOverview);
router.get('/stats', getFinancialStats);

// Withdrawal management
router.get('/withdrawals', getWithdrawalRequests);
router.get('/:withdrawalId/:withdrawalId', getWithdrawalById);
router.patch('/withdrawals/:withdrawalId/approve', approveWithdrawal);
router.patch('/withdrawals/:withdrawalId/reject', rejectWithdrawal);
router.patch('/withdrawals/:withdrawalId/process', processWithdrawal);

// Transaction management
router.get('/transactions', getTransactions);

// Export functionality
router.post('/export/transactions', exportTransactions);
router.post('/export/withdrawals', exportWithdrawals);

export default router;