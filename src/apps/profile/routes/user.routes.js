import express from 'express';
//import { authMiddleware } from '../middleware/auth.js';
import {
  getProfile,
  getUserPosts,
  getFollowers,
  getFollowing,
  toggleFollow,
} from '../controllers/user.controller.js';

const router = express.Router();

// All routes require authentication to know current user
//router.use(authMiddleware);

router.get('/:userId/profile', getProfile);
router.get('/:userId/posts', getUserPosts);
router.get('/:userId/followers', getFollowers);
router.get('/:userId/following', getFollowing);
router.post('/:userId/follow', toggleFollow);

export default router;