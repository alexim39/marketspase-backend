import express from 'express';
//import { verifyJWT } from '../middlewares/auth.middleware.js';
import { cloudinaryMediaUpload } from '../../../core/cloudinary.service.js';
import { toggleCommentLike } from '../controllers/toggle-comment-like.controller.js';
import { updateFeedPost } from '../controllers/update-post.controller.js';
import { deleteFeedPost } from '../controllers/delete-post.controller.js';
import { createFeedPost } from '../controllers/create-post.controller.js';
import { getFeedPosts } from '../controllers/get-posts.controller.js';
import { togglePostLike } from '../controllers/toggle-post-like.controller.js';
import { toggleSavePost } from '../controllers/toggle-post-save.controller.js';
import { addComment } from '../controllers/add-comment.controller.js';
import { sharePost } from '../controllers/share-post.controller.js';
import { trackPostChatClick } from '../controllers/track-post-chat.controller.js';
import { getPostById } from '../controllers/get-post-byid.controller.js';
import { getTrendingHashtags } from '../controllers/get-trending-hashtags.controller.js';
import { getCommunityFeed } from '../controllers/get-community-post.controller.js';
import { getPostComments } from '../controllers/get-post-comments.controller.js';
import { boostPost } from '../controllers/boost-post.controller.js';
import { repostFeedPost } from '../controllers/repost-feed-post.controller.js';
import { authenticate, optionalAuthenticate } from '../../../shared/middleware/auth.middleware.js';

const router = express.Router();

// Public routes
router.get('/list', optionalAuthenticate, getFeedPosts);
router.get('/community', optionalAuthenticate, getCommunityFeed);
router.get('/trending/hashtags', getTrendingHashtags);
router.get('/:postId/comments', optionalAuthenticate, getPostComments);
router.get('/:postId', optionalAuthenticate, getPostById);
router.post('/:postId/chat-click', optionalAuthenticate, trackPostChatClick);

router.use(authenticate);

router.post('/:postId/comments/:commentId/like', toggleCommentLike);
router.post('/create', cloudinaryMediaUpload.array('media', 6), createFeedPost);
router.post('/:postId/like', togglePostLike);
router.post('/:postId/save', toggleSavePost);
router.post('/:postId/comments', addComment);
router.post('/:postId/share', sharePost);
router.post('/:postId/boost', boostPost);
router.post('/:postId/repost', repostFeedPost);

router.put('/:postId', cloudinaryMediaUpload.array('media', 6), updateFeedPost);    // Edit post
router.delete('/:postId', deleteFeedPost); 

export default router;
