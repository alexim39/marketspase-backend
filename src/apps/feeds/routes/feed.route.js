import express from 'express';
//import { verifyJWT } from '../middlewares/auth.middleware.js';
import { toggleCommentLike } from '../controllers/toggle-comment-like.controller.js';
import { updateFeedPost } from '../controllers/update-post.controller.js';
import { deleteFeedPost } from '../controllers/delete-post.controller.js';
import { createFeedPost } from '../controllers/create-post.controller.js';
import { getFeedPosts } from '../controllers/get-posts.controller.js';
import { togglePostLike } from '../controllers/toggle-post-like.controller.js';
import { toggleSavePost } from '../controllers/toggle-post-save.controller.js';
import { addComment } from '../controllers/add-comment.controller.js';
import { sharePost } from '../controllers/share-post.controller.js';
import { getPostById } from '../controllers/get-post-byid.controller.js';
import { getTrendingHashtags } from '../controllers/get-trending-hashtags.controller.js';
import { getCommunityFeed } from '../controllers/get-community-post.controller.js';
import { getPostComments } from '../controllers/get-post-comments.controller.js';

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