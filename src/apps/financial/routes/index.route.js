import express from 'express';
const app = express();
app.use(express.json()); // Use json middleware
app.use(express.urlencoded({extended: false})); // Use formdata middleware

import router from './financial.routes.js';

const FinancialRouter = express.Router();

// Mount UserRouter under AuthRouter
FinancialRouter.use('/', router);


export default FinancialRouter;