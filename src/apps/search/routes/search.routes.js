import express from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware.js';
import { requireAdmin } from '../../../shared/middleware/authorization.middleware.js';
import {
  getSearchSuggestions,
  rebuildSearchIndex,
  searchEverything,
} from '../controllers/search.controller.js';

const router = express.Router();

router.use(authenticate);

router.get('/', searchEverything);
router.get('/suggestions', getSearchSuggestions);
router.post('/admin/reindex', requireAdmin, rebuildSearchIndex);

export default router;
