import express from 'express';
import {  
    SwitchUser, 
    UpdateProfile, 
    UpdateProfessionalInfo, 
    UpdateUsername, 
    getAppUsers,
    getAppUserById,
    toggleUserActiveStatus
} from '../controllers/user.controller.js'

const UserRouter = express.Router();

// admin - get all users
UserRouter.get('/users', getAppUsers);


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