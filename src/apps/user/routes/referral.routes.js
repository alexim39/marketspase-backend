// routes/promo.routes.js
import express from 'express';
import { ReferralStats, ReferralDetails, ValidateReferralCode } from './../controllers/referral.controller.js';

const ReferralRouter = express.Router();

ReferralRouter.get('/stats/:userId', ReferralStats);

ReferralRouter.get('/details/:userId', ReferralDetails);

ReferralRouter.get('/validate/:referralCode', ValidateReferralCode);



export default ReferralRouter;