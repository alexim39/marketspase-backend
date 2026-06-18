// routes/promo.routes.js
import express from 'express';

import { getUsers } from '../../controllers/admin/get-all-users.controller.js';
import { getUserById } from '../../controllers/admin/get-user-by-id.controller.js';
import { toggleUserActiveStatus } from '../../controllers/admin/toggle-user-status.controller.js';
import { getUsersByRole } from '../../controllers/admin/get-all-users-by-role.controller.js';
import { getUserStatsByRole } from '../../controllers/admin/get-statistics-by-role.controller.js';
import { getUserSummary } from '../../controllers/admin/get-user-summary.controller.js'
import { getRoleStatistics } from '../../controllers/admin/get-role-statistics.controller.js'
import { streamUsers } from '../../controllers/admin/stream-users.controller.js'
import { deleteUser } from '../../controllers/admin/delete-soft-user.controller.js'
import { restoreUser } from '../../controllers/admin/restore-user-soft.controller.js'
import { updateUserDisplayName } from '../../controllers/admin/update-user-displayname.controller.js'
import { markMarketingRep } from '../../controllers/admin/make-marketing-rep.controller.js'
import { getUserAnalytics } from '../../controllers/admin/get-user-analytics.controller.js';
import { requireAdmin } from '../../../../shared/middleware/authorization.middleware.js';
import UserGrowthRouter from './user-growth.routes.js';
import ActiveUsersRouter from './active-users.routes.js';


const AdminIndexRouter = express.Router();

AdminIndexRouter.use(requireAdmin);

// admin - get all users
AdminIndexRouter.get('/users', getUsers);

// analytics and summary routes should stay above parameterised user routes
AdminIndexRouter.get('/users/summary', getUserSummary);
AdminIndexRouter.get('/summary', getUserSummary);
AdminIndexRouter.get('/users/stream', streamUsers);
AdminIndexRouter.get('/stream', streamUsers);
AdminIndexRouter.get('/users/analytics', getUserAnalytics);
AdminIndexRouter.use('/users', UserGrowthRouter);
AdminIndexRouter.use('/users', ActiveUsersRouter);

// admin - get all users by role
AdminIndexRouter.get('/users/role/:role', getUsersByRole);
AdminIndexRouter.get('/users/:role', getUsersByRole);

// admin - get all users role statistics
AdminIndexRouter.get('/users/role/:role/stats', getRoleStatistics);
AdminIndexRouter.get('/users/:role/stats', getUserStatsByRole);

// toggle user active status
AdminIndexRouter.patch('/:id/status', toggleUserActiveStatus);

// update user displayname
AdminIndexRouter.patch('/users/:userId/display-name', updateUserDisplayName);
AdminIndexRouter.patch('/:userId/display-name', updateUserDisplayName);

// legacy aliases kept for compatibility with older admin app builds
AdminIndexRouter.get('/admin/users/role/:role/stats', getRoleStatistics);
AdminIndexRouter.patch('/users/make-marketing-rep', markMarketingRep);
AdminIndexRouter.patch('/make-marketing-rep', markMarketingRep);
AdminIndexRouter.patch('/admin/:id/restore', restoreUser); 

AdminIndexRouter.delete('/admin/:id', deleteUser);

// admin - get a user
AdminIndexRouter.get('/:id', getUserById);


export default AdminIndexRouter;
