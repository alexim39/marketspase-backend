import express from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware.js';
import { requireAdmin } from '../../../shared/middleware/authorization.middleware.js';
import {
  getAdminConfig,
  getDashboard,
  getFeed,
  saveAdminConfig,
} from './gamification.controller.js';

const router = express.Router();

router.use(authenticate);

router.get('/me/dashboard', getDashboard);
router.get('/me/feed', getFeed);

router.get('/admin/config', requireAdmin, getAdminConfig);
router.put('/admin/config', requireAdmin, saveAdminConfig);

export default router;
