import express from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware.js';
import { requireAdmin } from '../../../shared/middleware/authorization.middleware.js';
import {
  createDefinition,
  editDefinition,
  getAdminConfig,
  getBadgeFeed,
  getBadgeOverview,
  removeDefinition,
  updateAdminConfig,
} from './badge.controller.js';

const router = express.Router();

router.use(authenticate);

router.get('/me/feed', getBadgeFeed);
router.get('/users/:userId/overview', getBadgeOverview);

router.get('/admin/config', requireAdmin, getAdminConfig);
router.put('/admin/config', requireAdmin, updateAdminConfig);
router.post('/admin/definitions', requireAdmin, createDefinition);
router.put('/admin/definitions/:badgeId', requireAdmin, editDefinition);
router.delete('/admin/definitions/:badgeId', requireAdmin, removeDefinition);

export default router;
