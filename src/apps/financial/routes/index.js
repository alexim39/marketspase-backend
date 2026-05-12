import express from 'express';
const app = express();
app.use(express.json()); // Use json middleware
app.use(express.urlencoded({extended: false})); // Use formdata middleware

import router from './financial.routes.js';
import RefundRouter from './refund.routes.js';
import TransferRouter from './transfer.routes.js';
import { authenticate } from '../../../shared/middleware/auth.middleware.js';
import { requireAdmin } from '../../../shared/middleware/authorization.middleware.js';

const FinancialRouter = express.Router();

FinancialRouter.use(authenticate);
FinancialRouter.use(requireAdmin);

// Mount UserRouter under AuthRouter
FinancialRouter.use('/', router);

// Mount refundRouter under adminIndexRouter
FinancialRouter.use('/refund', RefundRouter);
// Mount transferRouter under adminIndexRouter
FinancialRouter.use('/transfer', TransferRouter);



export default FinancialRouter;
