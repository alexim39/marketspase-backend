// routes/promo.routes.js
import express from 'express';

import { getAppUsers } from '../../controllers/admin/get-all-users.controller.js';
import { getAppUserById } from '../../controllers/admin/get-user-by-id.controller.js';
import { toggleUserActiveStatus } from '../../controllers/admin/toggle-user-status.controller.js';
import { getAppUsersByRole } from '../../controllers/admin/get-all-users-by-role.controller.js';
import { getUserStatsByRole } from '../../controllers/admin/get-statistics-by-role.controller.js';
//import RefundRouter from './refund.routes.js';

const AdminIndexRouter = express.Router();

// Mount refundRouter under adminIndexRouter
//AdminIndexRouter.use('/refund', RefundRouter);

// admin - get all users
AdminIndexRouter.get('/users', getAppUsers);

// admin - get all users by role
AdminIndexRouter.get('/users/:role', getAppUsersByRole);

// admin - get all users role statistics
AdminIndexRouter.get('/users/:role/stats', getUserStatsByRole);

// admin - get a user
AdminIndexRouter.get('/:id', getAppUserById);

// toggle user active status
AdminIndexRouter.patch('/:id/status', toggleUserActiveStatus);

export default AdminIndexRouter;