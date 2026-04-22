// routes/transfer.routes.js
import express from 'express';
import {
  getTransferTransactions,
  getTransferStats,
  getTransferById
} from '../controllers/transfers/get-transfers.controller.js';
import { transferFunds } from './../..//wallet/controllers/transfer/transfer.controller.js';

const TransferRouter = express.Router();

// Transfer management
TransferRouter.get('/funds', getTransferTransactions);
TransferRouter.get('/stats', getTransferStats);
TransferRouter.get('/:transferId', getTransferById);
TransferRouter.post('/', transferFunds);

// Export functionality
TransferRouter.post('/export', (req, res) => {
  // Implement export logic similar to withdrawals
  res.json({ success: true, data: { url: '' } });
});

export default TransferRouter;