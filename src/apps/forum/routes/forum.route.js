import express from 'express';
import {
    getThreads, 
    getThreadById, 
    getThreadsByTags,
    deleteThread,
    updateThread,
    searchThreads,
    getCategories
} from '../controllers/thread.controller.js';
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
import {
    getCommunityStats,
    getPinnedThreads,
    getTrendingThreads,
    getActiveUsers,
    getPopularTags
} from '../controllers/forum-stats.controller.js';
import {
    pinThread,
    unpinThread,
    reorderPinnedThreads,
    getAllPinnedThreads,
    togglePinThread
} from '../controllers/pin-thread.controller.js';
import { authenticate } from '../../../shared/middleware/auth.middleware.js';

const router = express.Router();

// ==================== Thread Routes ====================

// Create new thread
router.post('/threads/new', authenticate, createThread);

// Get all threads (with pagination and filters)
router.get('/threads', getThreads);

// Search threads
router.get('/threads/search', searchThreads);

// Get threads by tag
router.get('/threads/tags/:tags', getThreadsByTags);

// Get a single thread by ID
router.get('/thread/:id', getThreadById);

// Update a thread by ID
router.put('/threads/:threadId', authenticate, updateThread);

// Delete a thread by ID
router.delete('/thread/:threadId/:userId', authenticate, deleteThread);

// Like/unlike a thread
router.put('/thread/like', authenticate, toggleThreadLike);

// ==================== Comment Routes ====================

// Add a new comment to a thread
router.post('/thread/comment/new', authenticate, addCommentToThread);

// Add a reply to a comment
router.post('/thread/comment/reply', authenticate, addCommentReply);

// Update a comment by ID
router.put('/comments/:commentId', authenticate, updateComment);

// Toggle like on a comment
router.post('/comments/like', authenticate, toggleLikeComment);

// Toggle like on a reply
router.post('/comments/reply/like', authenticate, toggleLikeReply);

// Delete a comment by ID
router.delete('/comment/:commentId/:userId', authenticate, deleteComment);

// Delete a reply by ID
router.delete('/reply/:replyId/:userId', authenticate, deleteReply);

// ==================== Community Stats Routes ====================

// Get community statistics (members, discussions, comments, etc.)
router.get('/stats', getCommunityStats);

// Get pinned/featured threads
router.get('/threads/pinned', getPinnedThreads);

// Get trending threads
router.get('/threads/trending', getTrendingThreads);

// Get active users/contributors
router.get('/users/active', getActiveUsers);

// Get popular tags
router.get('/tags/popular', getPopularTags);

// Get thread categories with counts
router.get('/categories', getCategories);

// ==================== Pin Thread Routes ====================

// Get all pinned threads with full details
router.get('/threads/pinned/all', getAllPinnedThreads);

// Pin a thread (Admin/Moderator only)
router.put('/threads/:threadId/pin', authenticate, pinThread);

// Unpin a thread (Admin/Moderator only)
router.put('/threads/:threadId/unpin', authenticate, unpinThread);

// Toggle pin status (convenience method)
router.put('/threads/:threadId/toggle-pin', authenticate, togglePinThread);

// Reorder pinned threads (Admin/Moderator only)
router.put('/threads/pinned/reorder', authenticate, reorderPinnedThreads);

export default router;
