import express from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware.js';
import { requireAdmin } from '../../../shared/middleware/authorization.middleware.js';
import {
  getAdminConfig,
  getLeaderboardStats,
  getStatus,
  pingSession,
  startSession,
  updateAdminConfig,
  withdrawPoints,
} from './login-streak.controller.js';

const router = express.Router();

router.use(authenticate);

router.post('/session/start', startSession);
router.post('/session/ping', pingSession);
router.get('/status', getStatus);
router.get('/leaderboard', getLeaderboardStats);
router.post('/withdraw', withdrawPoints);

router.get('/admin/config', requireAdmin, getAdminConfig);
router.put('/admin/config', requireAdmin, updateAdminConfig);

export default router;
