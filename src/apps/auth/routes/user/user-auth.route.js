import express from 'express';
import {
    Authenticate, GetUser
} from '../../controllers/user-auth.controller.js'
import { authenticate } from '../../../../shared/middleware/auth.middleware.js';

const UserRouter = express.Router();

// Authenticate/Verify User
UserRouter.post('/', Authenticate);
// Get User record
UserRouter.get('/:uid', authenticate, GetUser);

export default UserRouter;
