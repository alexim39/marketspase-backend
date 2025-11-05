import express from 'express';
import {
    signin, getAdmin, signout, createAdmin
} from '../../controllers/admin-auth.controller.js'

const AdminRouter = express.Router();

// create
AdminRouter.post('/create', createAdmin);
// login
AdminRouter.post('/signin', signin);
// Get admin
AdminRouter.get('/user', getAdmin);
// logout
AdminRouter.post('/signout', signout);

export default AdminRouter;