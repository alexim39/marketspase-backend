


import express from 'express';
import { deleteSavedAccount } from '../controllers/delete-saved-account.controller.js'
import {
  getAdminPaymentConfig,
  getCurrencyQuote,
  getPublicCurrencyConfig,
  getWalletOverview,
  saveAdminPaymentConfig,
  updateWalletDisplayCurrency,
  validateQuotePayload,
} from '../controllers/payment-currency.controller.js'
import { withdrawRequest } from '../controllers/withdrawal/withdrawal.controller.js'
import { getVerifiedAccounts } from '../controllers/withdrawal/get-gerified-accounts.controller.js'
import { verifyAndRecordPayment, verifyPaymentStatus } from '../controllers/verify-record-payment.controller.js'
import { verifyBankAccount } from '../controllers/verify-bankacount.controller.js'
import { authenticate } from '../../../shared/middleware/auth.middleware.js';
import { requireAdmin } from '../../../shared/middleware/authorization.middleware.js';

const IndexRouter = express.Router();

IndexRouter.get('/currencies/config', getPublicCurrencyConfig);
IndexRouter.get('/currencies/quote', getCurrencyQuote);
IndexRouter.post('/currencies/validate-quote', validateQuotePayload);

IndexRouter.use(authenticate);

// returnd paystck key
IndexRouter.get('/resolve-account', verifyBankAccount);

IndexRouter.get('/wallet-overview', getWalletOverview);
IndexRouter.put('/display-currency', updateWalletDisplayCurrency);

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

IndexRouter.get('/admin/payment-config', requireAdmin, getAdminPaymentConfig);
IndexRouter.put('/admin/payment-config', requireAdmin, saveAdminPaymentConfig);

export default IndexRouter;
