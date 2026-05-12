


import express from 'express';
import { deleteSavedAccount } from '../controllers/delete-saved-account.controller.js'
import { withdrawRequest } from '../controllers/withdrawal/withdrawal.controller.js'
import { getVerifiedAccounts } from '../controllers/withdrawal/get-gerified-accounts.controller.js'
import { verifyAndRecordPayment, verifyPaymentStatus } from '../controllers/verify-record-payment.controller.js'
import { verifyBankAccount } from '../controllers/verify-bankacount.controller.js'
import { authenticate } from '../../../shared/middleware/auth.middleware.js';

const IndexRouter = express.Router();

IndexRouter.use(authenticate);

// returnd paystck key
IndexRouter.get('/resolve-account', verifyBankAccount);

// Payment verification using frontend callback
IndexRouter.post('/verify-and-record', verifyAndRecordPayment);
// payment verification usng reference retry
IndexRouter.get('/verify-payment/:reference', verifyPaymentStatus);

// Withdrawal endpoints
IndexRouter.post('/withdraw-request', withdrawRequest);

// Account management
IndexRouter.delete('/saved-accounts/:userId/:accountNumber', deleteSavedAccount);

// Account verification endpoints
IndexRouter.post('/verify-account', verifyBankAccount);
IndexRouter.get('/verified-accounts/:userId', getVerifiedAccounts);

export default IndexRouter;
