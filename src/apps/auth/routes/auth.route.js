import express from 'express';
import {
    Authenticate, GetUser
} from '../controllers/auth.controller.js'

const AuthRouter = express.Router();


// Authenticate/Verify User
AuthRouter.post('/', Authenticate);
// Get User record
AuthRouter.get('/:uid', GetUser);

export default AuthRouter;