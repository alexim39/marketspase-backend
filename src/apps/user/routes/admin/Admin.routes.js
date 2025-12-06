// routes/promo.routes.js
import express from 'express';

import { getAppUsers } from '../../controllers/admin/get-all-users.controller.js';
import { getAppUserById } from '../../controllers/admin/get-user-by-id.controller.js';
import { toggleUserActiveStatus } from '../../controllers/admin/toggle-user-status.controller.js';
import { getAppUsersByRole } from '../../controllers/admin/get-all-users-by-role.controller.js';
import { getUserStatsByRole } from '../../controllers/admin/get-statistics-by-role.controller.js';

const AdminRouter = express.Router();

// admin - get all users
AdminRouter.get('/users', getAppUsers);

// admin - get all users by role
AdminRouter.get('/users/:role', getAppUsersByRole);

// admin - get all users role statistics
AdminRouter.get('/users/:role/stats', getUserStatsByRole);

// admin - get a user
AdminRouter.get('/:id', getAppUserById);

// toggle user active status
AdminRouter.patch('/:id/status', toggleUserActiveStatus);

export default AdminRouter;