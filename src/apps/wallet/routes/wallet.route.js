import express from 'express';
import { verifyAndRecordPayment } from '../controllers/wallet.controller.js'


const WalletRouter = express.Router();

// 
WalletRouter.post('/verify-and-record', verifyAndRecordPayment);

export default WalletRouter;