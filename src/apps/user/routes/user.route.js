import express from 'express';
import {  
    SwitchUser 
} from '../controllers/user.controller.js'
//import {createOrUpdateTestimonial, getTestimonials, reactToTestimonial, getUserTestimonial} from '../controllers/testimonial.controller.js'

const UserRouter = express.Router();

/**
 * Submits the user data to the controller.
 * Method: post
 * /api/users/switch-user:
 */
UserRouter.post('/switch-user', SwitchUser);


export default UserRouter;