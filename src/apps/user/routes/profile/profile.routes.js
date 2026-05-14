// routes/promo.routes.js
import express from 'express';
import { UpdateProfile } from '../../controllers/profile-update.controller.js'
import { UpdateUsername } from '../../controllers/profile/update-username.controller.js';
import { UpdateProfessionalInfo } from '../../controllers/profile/update-user-professtion.controller.js';
import { UpdatePublicIdentity } from '../../controllers/profile/update-public-identity.controller.js';

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
 * Submits the public identity data to the controller.
 * Method: put
 * /api/users/profile/public-identity:
 */
ProfileRouter.put('/public-identity', UpdatePublicIdentity);

/**
 * Submits the user data to the controller.
 * Method: put
 * /api/users/profile/profession:
 */
ProfileRouter.put('/username', UpdateUsername);

export default ProfileRouter;
