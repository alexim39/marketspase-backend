import express from 'express';
import {
  getProfile,
  getUserPosts,
  getFollowers,
  getFollowing,
  toggleFollow,
} from '../controllers/user.controller.js';
import { getSuggestedUsers } from '../controllers/get-suggested-user-controller.js';
import { authenticate, optionalAuthenticate } from '../../../shared/middleware/auth.middleware.js';

const router = express.Router();

router.get('/suggested', getSuggestedUsers);
router.get('/:userId/profile', optionalAuthenticate, getProfile);
router.get('/:userId/posts', optionalAuthenticate, getUserPosts);
router.get('/:userId/followers', optionalAuthenticate, getFollowers);
router.get('/:userId/following', optionalAuthenticate, getFollowing);
router.post('/:userId/follow', authenticate, toggleFollow);

export default router;
