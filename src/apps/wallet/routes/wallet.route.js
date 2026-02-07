


import express from 'express';
import { deleteSavedAccount } from '../controllers/delete-saved-account.controller.js'
import { withdrawRequest } from '../controllers/withdrawal/withdrawal.controller.js'
import { getVerifiedAccounts } from '../controllers/withdrawal/get-gerified-accounts.controller.js'
import { verifyAndRecordPayment } from '../controllers/verify-record-payment.controller.js'
import { verifyBankAccount } from '../controllers/withdrawal/verify-bankacount.controller.js'

const IndexRouter = express.Router();

// Payment verification
IndexRouter.post('/verify-and-record', verifyAndRecordPayment);

// Withdrawal endpoints
IndexRouter.post('/withdraw-request', withdrawRequest);

// Account management
IndexRouter.delete('/saved-accounts/:userId/:accountNumber', deleteSavedAccount);

// Account verification endpoints
IndexRouter.post('/verify-account', verifyBankAccount);
IndexRouter.get('/verified-accounts/:userId', getVerifiedAccounts);

export default IndexRouter;