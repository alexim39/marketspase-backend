import express from 'express';
import { verifyAndRecordPayment, deleteSavedAccount } from '../controllers/wallet.controller.js'
import { withdrawRequest } from '../controllers/withdrawal.controller.js'


const WalletRouter = express.Router();

// 
WalletRouter.post('/verify-and-record', verifyAndRecordPayment);

// get balance
//TransactionRouter.get('/:userId', getTransactions);

// confirm payment
WalletRouter.post('/withdraw-request', withdrawRequest);

// confirm payment
WalletRouter.delete('/saved-accounts/:userId/:accountNumber', deleteSavedAccount);

export default WalletRouter;