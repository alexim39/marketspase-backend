// routes/promo.routes.js
import express from 'express';

import { getUsers } from '../../controllers/admin/get-all-users.controller.js';
import { getUserById } from '../../controllers/admin/get-user-by-id.controller.js';
import { toggleUserActiveStatus } from '../../controllers/admin/toggle-user-status.controller.js';
import { getUsersByRole } from '../../controllers/admin/get-all-users-by-role.controller.js';
import { getUserStatsByRole } from '../../controllers/admin/get-statistics-by-role.controller.js';
//import RefundRouter from './refund.routes.js';

const AdminIndexRouter = express.Router();

// Mount refundRouter under adminIndexRouter
//AdminIndexRouter.use('/refund', RefundRouter);

// admin - get all users
AdminIndexRouter.get('/users', getUsers);

// admin - get all users by role
AdminIndexRouter.get('/users/:role', getUsersByRole);

// admin - get all users role statistics
AdminIndexRouter.get('/users/:role/stats', getUserStatsByRole);

// admin - get a user
AdminIndexRouter.get('/:id', getUserById);

// toggle user active status
AdminIndexRouter.patch('/:id/status', toggleUserActiveStatus);



// New routes
// Main users routes with pagination
/* router.get('/admin/users/summary', getUserSummary);
router.get('/admin/users/stream', streamUsers);

// Role-based routes
router.get('/admin/users/role/:role', getUsersByRole);
router.get('/admin/users/role/:role/stats', getRoleStatistics);

// Individual user routes
router.get('/admin/:id', getUserById);
router.patch('/admin/:id/status', updateUserStatus);
router.delete('/admin/:id', deleteUser);
router.patch('/admin/:id/restore', restoreUser); */

export default AdminIndexRouter;