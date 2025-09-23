import express from 'express';
import { deleteSavedAccount } from '../controllers/delet-saved-account.controller.js'
import { withdrawRequest } from '../controllers/withdrawal.controller.js'
import { verifyAndRecordPayment } from '../controllers/verify-record-payment.controller.js'


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