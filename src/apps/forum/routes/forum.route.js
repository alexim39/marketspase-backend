import express from 'express';
import {
    getThreads, 
    getThreadById, 
    getThreadsByTags,
    deleteThread,
    updateThread
} from '../controllers/thread.controller.js'
import { createThread } from '../controllers/create-thread.controller.js';
import { toggleThreadLike } from '../controllers/toggle-thread-like.controller.js';
import {
    addCommentToThread,
    addCommentReply,
    toggleLikeComment,
    toggleLikeReply,
    deleteComment,
    deleteReply,
    updateComment
} from '../controllers/comment.controller.js';
const router = express.Router();

// add new thread
router.post('/threads/new', createThread);
// get a thread by ID
router.get('/thread/:id', getThreadById);
// get all threads
router.get('/threads', getThreads);
// update a comment by ID  
router.put('/comments/:commentId', updateComment);
// update a thread by ID
router.put('/threads/:threadId', updateThread);

// get comments for a specific thread
// add a new comment to a thread
router.post('/thread/comment/new', addCommentToThread);
// add comment reply in a thread
router.post('/thread/comment/reply', addCommentReply);
// like/dislike a thread
router.put('/thread/like', toggleThreadLike);
// get threads by tag
router.get('/threads/tags/:tags', getThreadsByTags);
// Toggle like/dislike for a comment
router.post('/comments/like', toggleLikeComment);
// Toggle like/dislike for a reply
router.post('/comments/reply/like', toggleLikeReply);
// delete threads by id
router.delete('/thread/:threadId/:userId', deleteThread);
// delete comment by id
router.delete('/comment/:commentId/:userId', deleteComment);
// delete reply by id
router.delete('/reply/:replyId/:userId', deleteReply);
export default router;