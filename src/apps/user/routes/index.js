import express from 'express';
const app = express();
app.use(express.json()); // Use json middleware
app.use(express.urlencoded({extended: false})); // Use formdata middleware

import { SwitchUser } from '../controllers/switch-user.controller.js'
import {
  getOnboardingState,
  completeOnboardingStep,
  dismissOnboarding,
  getMatchingCampaigns,
  getPerformanceBenchmarks,
} from '../controllers/growth-features.controller.js';
import {
  getPromoterTier,
  getPromoterTrustMetrics,
  bulkInvitePromoters,
} from '../controllers/promoter-features.controller.js';

import PromoRouter from './promo/promo.routes.js';
//import StatsRouter from './stats/stats.routes.js';
import ProfileRouter from './profile/profile.routes.js';
import ReferralRouter from './referral/referral.routes.js';
import AdminIndexRouter from './admin/Admin-index.routes.js';
import { authenticate } from '../../../shared/middleware/auth.middleware.js';


const UserRouter = express.Router();

UserRouter.use(authenticate);

// Mount PromoRouter under UserRouter
UserRouter.use('/promo', PromoRouter);
// Mount StatsRouter under UserRouter
//UserRouter.use('/stats', StatsRouter);
// Mount ProfileRouter under UserRouter
UserRouter.use('/profile', ProfileRouter);
// Mount referrals under UserRouter
UserRouter.use('/referral', ReferralRouter);
// Mount admin under AdminRouter
UserRouter.use('/admin', AdminIndexRouter);


// admin - get all users
//UserRouter.get('/users', getAppUsers);


/**
 * Submits the user data to the controller.
 * Method: post
 * /api/users/switch-user:
 */
UserRouter.post('/switch-user', SwitchUser);

// Growth features
UserRouter.get('/onboarding', getOnboardingState);
UserRouter.post('/onboarding/complete', completeOnboardingStep);
UserRouter.post('/onboarding/dismiss', dismissOnboarding);
UserRouter.get('/matching-campaigns', getMatchingCampaigns);
UserRouter.get('/performance-benchmarks', getPerformanceBenchmarks);
UserRouter.get('/promoter/:userId/tier', getPromoterTier);
UserRouter.get('/promoter/:promoterId/trust', getPromoterTrustMetrics);
UserRouter.post('/campaign/:campaignId/bulk-invite', bulkInvitePromoters);


/* Dynamic Routes */

// admin - get a user
//UserRouter.get('/:id', getAppUserById);

/**
 * Submits the user status data to the controller.
 * Method: patch
 * /api/users/${id}/status:
 */
//UserRouter.patch('/:id/status', toggleUserActiveStatus);


export default UserRouter;
