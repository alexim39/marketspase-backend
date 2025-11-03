import express from 'express';
import {
    Authenticate, GetUser
} from '../../controllers/user-auth.controller.js'

const UserRouter = express.Router();

// Authenticate/Verify User
UserRouter.post('/', Authenticate);
// Get User record
UserRouter.get('/:uid', GetUser);

export default UserRouter;