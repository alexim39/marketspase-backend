import express from 'express';
import {  
    SwitchUser, UpdateProfile, UpdateProfessionalInfo, UpdateUsername
} from '../controllers/user.controller.js'
//import {createOrUpdateTestimonial, getTestimonials, reactToTestimonial, getUserTestimonial} from '../controllers/testimonial.controller.js'

const UserRouter = express.Router();

/**
 * Submits the user data to the controller.
 * Method: post
 * /api/users/switch-user:
 */
UserRouter.post('/switch-user', SwitchUser);

/**
 * Submits the user data to the controller.
 * Method: put
 * /api/users/profile/personal:
 */
UserRouter.put('/profile/personal', UpdateProfile);

/**
 * Submits the user data to the controller.
 * Method: put
 * /api/users/profile/profession:
 */
UserRouter.put('/profile/profession', UpdateProfessionalInfo);

/**
 * Submits the user data to the controller.
 * Method: put
 * /api/users/profile/profession:
 */
UserRouter.put('/profile/username', UpdateUsername);


export default UserRouter;