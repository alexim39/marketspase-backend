import express from 'express';
const app = express();
app.use(express.json()); // Use json middleware
app.use(express.urlencoded({extended: false})); // Use formdata middleware

import IndexRouter from './wallet.route.js';
import TransferRouter from './transfer/transfer.routes.js';

const WalletRouter = express.Router();

// Mount Wallet routes
WalletRouter.use('/', IndexRouter);
// Mount transfer routes
WalletRouter.use('/transfer', TransferRouter);


export default WalletRouter;