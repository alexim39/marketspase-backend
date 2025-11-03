import express from 'express';
const app = express();
app.use(express.json()); // Use json middleware
app.use(express.urlencoded({extended: false})); // Use formdata middleware

import AdminRouter from './admin/admin-auth.route.js';
import UserRouter from './user/user-auth.route.js';

const AuthRouter = express.Router();

// Mount UserRouter under AuthRouter
AuthRouter.use('/', UserRouter);
// Mount AdminRouter under AuthRouter
AuthRouter.use('/admin', AdminRouter);


export default AuthRouter;