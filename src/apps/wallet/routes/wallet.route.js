


import express from 'express';
import { deleteSavedAccount } from '../controllers/delete-saved-account.controller.js'
import { withdrawRequest } from '../controllers/withdrawal/withdrawal.controller.js'
import { getVerifiedAccounts } from '../controllers/withdrawal/get-gerified-accounts.controller.js'
import { verifyAndRecordPayment } from '../controllers/verify-record-payment.controller.js'
import { verifyBankAccount } from '../controllers/withdrawal/verify-bankacount.controller.js'

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