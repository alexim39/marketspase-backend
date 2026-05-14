import express from 'express';
import { 
  transferFunds, 
  getWalletBalances, 
  searchUsers,
  checkWithdrawableAmount 
} from '../../controllers/transfer/transfer.controller.js';
import { authenticate } from '../../../../shared/middleware/auth.middleware.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Transfer funds
router.post('/', transferFunds);

// Get wallet balances
router.get('/balances/:userId', getWalletBalances);

// Search users for transfer
router.get('/users/search', searchUsers);

// Check withdrawable amount
router.get('/withdrawable/:userId/:walletType', checkWithdrawableAmount);

export default router;
