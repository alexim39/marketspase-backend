import express from 'express';
import { 
    getTransactions,
    withdrawRequest, deleteSavedAccount
} from '../controllers/transaction.controller.js'

const TransactionRouter = express.Router();

// get transactions
TransactionRouter.get('/:userId', getTransactions);

// confirm payment
TransactionRouter.post('/withdraw-request', withdrawRequest);

// confirm payment
TransactionRouter.delete('/saved-accounts/:userId/:accountId', deleteSavedAccount);

export default TransactionRouter;