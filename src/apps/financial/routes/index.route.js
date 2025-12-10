import express from 'express';
const app = express();
app.use(express.json()); // Use json middleware
app.use(express.urlencoded({extended: false})); // Use formdata middleware

import router from './financial.routes.js';
import RefundRouter from './refund.routes.js';

const FinancialRouter = express.Router();



// Mount UserRouter under AuthRouter
FinancialRouter.use('/', router);

// Mount refundRouter under adminIndexRouter
FinancialRouter.use('/refund', RefundRouter);



export default FinancialRouter;