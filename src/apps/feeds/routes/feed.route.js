import express from 'express';
//import { verifyJWT } from '../middlewares/auth.middleware.js';
import {
  createFeedPost,
  getFeedPosts,
  togglePostLike,
  toggleSavePost,
  addComment,
  sharePost,
  getPostById,
  getTrendingHashtags
} from '../controllers/feed.controller.js';

const router = express.Router();

// Public routes
router.get('/list', getFeedPosts);
router.get('/trending/hashtags', getTrendingHashtags);
router.get('/:postId', getPostById);

// Protected routes
//router.use(verifyJWT); // All routes below require authentication

router.post('/create', createFeedPost);
router.post('/:postId/like', togglePostLike);
router.post('/:postId/save', toggleSavePost);
router.post('/:postId/comments', addComment);
router.post('/:postId/share', sharePost);

export default router;