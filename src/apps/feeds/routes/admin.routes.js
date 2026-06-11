import express from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware.js';
import { requireAdmin } from '../../../shared/middleware/authorization.middleware.js';
import { adminGetPosts } from '../controllers/admin/admin-get-posts.controller.js';
import { adminGetPostDetail } from '../controllers/admin/admin-get-post-detail.controller.js';
import { adminToggleFeaturePost } from '../controllers/admin/admin-feature-post.controller.js';
import { adminDeletePost } from '../controllers/admin/admin-delete-post.controller.js';

const router = express.Router();

// All admin feed routes require authentication + admin role
router.use(authenticate);
router.use(requireAdmin);

// GET /api/v1/feed/admin/posts - List all posts with filters
router.get('/posts', adminGetPosts);

// GET /api/v1/feed/admin/posts/:postId - Get post details
router.get('/posts/:postId', adminGetPostDetail);

// PATCH /api/v1/feed/admin/posts/:postId/feature - Feature/unfeature a post
router.patch('/posts/:postId/feature', adminToggleFeaturePost);

// DELETE /api/v1/feed/admin/posts/:postId - Delete a post (soft by default)
router.delete('/posts/:postId', adminDeletePost);

export default router;
