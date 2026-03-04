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
  getTrendingHashtags,
  getCommunityFeed,
  getPostComments,
  toggleCommentLike
} from '../controllers/feed.controller.js';
import { updateFeedPost } from '../controllers/update-post.controller.js';
import { deleteFeedPost } from '../controllers/delete-post.controller.js';

const router = express.Router();

// Public routes
router.get('/list', getFeedPosts);
router.get('/community', getCommunityFeed);
router.get('/trending/hashtags', getTrendingHashtags);
router.get('/:postId/comments', getPostComments);

router.post('/:postId/comments/:commentId/like', toggleCommentLike);
router.get('/:postId', getPostById);

router.post('/create', createFeedPost);
router.post('/:postId/like', togglePostLike);
router.post('/:postId/save', toggleSavePost);
router.post('/:postId/comments', addComment);
router.post('/:postId/share', sharePost);

router.put('/:postId', updateFeedPost);    // Edit post
router.delete('/:postId', deleteFeedPost); 

export default router;