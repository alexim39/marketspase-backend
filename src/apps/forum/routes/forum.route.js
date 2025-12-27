import express from 'express';
import {
    getThreads, 
    getThreadById, 
    getThreadsByTags,
    deleteThread
} from '../controllers/thread.controller.js'
import { createThread } from '../controllers/create-thread.controller.js';
import { toggleThreadLike } from '../controllers/toggle-thread-like.controller.js';
import {
    addCommentToThread,
    addCommentReply,
    toggleLikeComment,
    toggleLikeReply,
    deleteComment,
    deleteReply
} from '../controllers/comment.controller.js';
const ForumRouter = express.Router();

// add new thread
ForumRouter.post('/threads/new', createThread);
// get a thread by ID
ForumRouter.get('/thread/:id', getThreadById);
// get all threads
ForumRouter.get('/threads', getThreads);
// get comments for a specific thread
// add a new comment to a thread
ForumRouter.post('/thread/comment/new', addCommentToThread);
// add comment reply in a thread
ForumRouter.post('/thread/comment/reply', addCommentReply);
// like/dislike a thread
ForumRouter.put('/thread/like', toggleThreadLike);
// get threads by tag
ForumRouter.get('/threads/tags/:tags', getThreadsByTags);
// Toggle like/dislike for a comment
ForumRouter.post('/comments/like', toggleLikeComment);
// Toggle like/dislike for a reply
ForumRouter.post('/comments/reply/like', toggleLikeReply);
// delete threads by id
ForumRouter.delete('/thread/:threadId/:userId', deleteThread);
// delete comment by id
ForumRouter.delete('/comment/:commentId/:userId', deleteComment);
// delete reply by id
ForumRouter.delete('/reply/:replyId/:userId', deleteReply);
export default ForumRouter;