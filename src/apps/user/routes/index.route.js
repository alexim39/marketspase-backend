import express from 'express';
const app = express();
app.use(express.json()); // Use json middleware
app.use(express.urlencoded({extended: false})); // Use formdata middleware
import {  
    getAppUsers,
    getAppUserById,
    toggleUserActiveStatus
} from '../controllers/user.controller.js';
import { SwitchUser } from '../controllers/switch-user.controller.js'

import PromoRouter from './promo/promo.routes.js';
import StatsRouter from './stats/stats.routes.js';
import ProfileRouter from './profile/profile.routes.js';
import ReferralRouter from './referral.routes.js';


const UserRouter = express.Router();

// Mount PromoRouter under UserRouter
UserRouter.use('/promo', PromoRouter);
// Mount StatsRouter under UserRouter
UserRouter.use('/stats', StatsRouter);
// Mount ProfileRouter under UserRouter
UserRouter.use('/profile', ProfileRouter);
// Mount referrals under UserRouter
UserRouter.use('/referral', ReferralRouter);


// admin - get all users
UserRouter.get('/users', getAppUsers);


/**
 * Submits the user data to the controller.
 * Method: post
 * /api/users/switch-user:
 */
UserRouter.post('/switch-user', SwitchUser);


/* Dynamic Routes */

// admin - get a user
UserRouter.get('/:id', getAppUserById);

/**
 * Submits the user status data to the controller.
 * Method: patch
 * /api/users/${id}/status:
 */
UserRouter.patch('/:id/status', toggleUserActiveStatus);


export default UserRouter;