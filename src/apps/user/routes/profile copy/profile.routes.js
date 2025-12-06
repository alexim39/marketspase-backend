// routes/promo.routes.js
import express from 'express';
import { UpdateProfile } from '../../controllers/profile-update.controller.js'
import { UpdateProfessionalInfo, UpdateUsername } from '../../controllers/admin/user.controller.js';

const ProfileRouter = express.Router();

/**
 * Submits the user data to the controller.
 * Method: put
 * /api/users/profile/personal:
 */
ProfileRouter.put('/personal', UpdateProfile);

/**
 * Submits the user data to the controller.
 * Method: put
 * /api/users/profile/profession:
 */
ProfileRouter.put('/profession', UpdateProfessionalInfo);

/**
 * Submits the user data to the controller.
 * Method: put
 * /api/users/profile/profession:
 */
ProfileRouter.put('/username', UpdateUsername);

export default ProfileRouter;