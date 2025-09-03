import express from 'express';
import {
    signin, getAdmin, signout, createAdmin
} from '../controllers/auth.controller.js'

const AdminAuthRouter = express.Router();

// login
AdminAuthRouter.post('/create', createAdmin);
// login
AdminAuthRouter.post('/signin', signin);
// Get admin
AdminAuthRouter.get('/', getAdmin);
// logout
AdminAuthRouter.post('/signout', signout);

export default AdminAuthRouter;