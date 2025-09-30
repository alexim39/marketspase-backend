/* import express from 'express';
import { deleteSavedAccount } from '../controllers/delet-saved-account.controller.js'
import { withdrawRequest } from '../controllers/withdrawal.controller.js'
import { verifyAndRecordPayment } from '../controllers/verify-record-payment.controller.js'


const WalletRouter = express.Router();

// 
WalletRouter.post('/verify-and-record', verifyAndRecordPayment);

// confirm payment
WalletRouter.post('/withdraw-request', withdrawRequest);

// confirm payment
WalletRouter.delete('/saved-accounts/:userId/:accountNumber', deleteSavedAccount);

export default WalletRouter; */



import express from 'express';
import { deleteSavedAccount } from '../controllers/delete-saved-account.controller.js'
import { withdrawRequest, verifyBankAccount, getVerifiedAccounts } from '../controllers/withdrawal.controller.js'
import { verifyAndRecordPayment } from '../controllers/verify-record-payment.controller.js'

const WalletRouter = express.Router();

// Payment verification
WalletRouter.post('/verify-and-record', verifyAndRecordPayment);

// Withdrawal endpoints
WalletRouter.post('/withdraw-request', withdrawRequest);

// Account management
WalletRouter.delete('/saved-accounts/:userId/:accountNumber', deleteSavedAccount);

// Account verification endpoints
WalletRouter.post('/verify-account', verifyBankAccount);
WalletRouter.get('/verified-accounts/:userId', getVerifiedAccounts);

export default WalletRouter;