import express from 'express';
import rateLimit from 'express-rate-limit';
import {
    Authenticate,
    GetUser,
    LocalSignIn,
    LocalSignUp,
    RequestLocalPasswordReset,
    ResetLocalPassword,
} from '../../controllers/user-auth.controller.js'
import { authenticate } from '../../../../shared/middleware/auth.middleware.js';

const UserRouter = express.Router();
const localAuthLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many authentication attempts. Please try again later.' },
});

// Authenticate/Verify User
UserRouter.post('/', Authenticate);
UserRouter.post('/local/signin', localAuthLimiter, LocalSignIn);
UserRouter.post('/local/signup', localAuthLimiter, LocalSignUp);
UserRouter.post('/local/request-password-reset', localAuthLimiter, RequestLocalPasswordReset);
UserRouter.post('/local/reset-password', localAuthLimiter, ResetLocalPassword);
// Get User record
UserRouter.get('/:uid', authenticate, GetUser);

export default UserRouter;
