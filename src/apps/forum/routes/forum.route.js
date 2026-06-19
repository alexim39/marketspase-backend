import express from 'express';
import {
    getThreads, 
    getThreadById, 
    getThreadsByTags,
    deleteThread,
    updateThread,
    searchThreads,
    getCategories,
    toggleThreadFollow,
    toggleTopicFollow,
    getMyForumFollows,
    voteThreadPoll,
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
    getPopularTags,
    getHotTopics,
} from '../controllers/forum-stats.controller.js';
import {
    pinThread,
    unpinThread,
    reorderPinnedThreads,
    getAllPinnedThreads,
    togglePinThread
} from '../controllers/pin-thread.controller.js';
import { authenticate, optionalAuthenticate } from '../../../shared/middleware/auth.middleware.js';

const router = express.Router();

// ==================== Thread Routes ====================

// Create new thread
router.post('/threads/new', authenticate, createThread);

// Get all threads (with pagination and filters)
router.get('/threads', optionalAuthenticate, getThreads);

// Search threads
router.get('/threads/search', optionalAuthenticate, searchThreads);

// Get threads by tag
router.get('/threads/tags/:tags', optionalAuthenticate, getThreadsByTags);

// Get a single thread by ID
router.get('/thread/:id', optionalAuthenticate, getThreadById);

// Update a thread by ID
router.put('/threads/:threadId', authenticate, updateThread);

// Delete a thread by ID
router.delete('/thread/:threadId/:userId', authenticate, deleteThread);
router.delete('/thread/:threadId/me', authenticate, deleteThread);

// Like/unlike a thread
router.put('/thread/like', authenticate, toggleThreadLike);

// Follow / unfollow a thread
router.post('/thread/:threadId/follow', authenticate, toggleThreadFollow);

// Vote on a thread poll
router.post('/thread/:threadId/poll/vote', authenticate, voteThreadPoll);

// View current forum follows
router.get('/follows', authenticate, getMyForumFollows);

// Follow / unfollow a topic
router.post('/topics/:topic/follow', authenticate, toggleTopicFollow);

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
router.delete('/comment/:commentId/me', authenticate, deleteComment);

// Delete a reply by ID
router.delete('/reply/:replyId/:userId', authenticate, deleteReply);
router.delete('/reply/:replyId/me', authenticate, deleteReply);

// ==================== Community Stats Routes ====================

// Get community statistics (members, discussions, comments, etc.)
router.get('/stats', optionalAuthenticate, getCommunityStats);

// Get pinned/featured threads
router.get('/threads/pinned', optionalAuthenticate, getPinnedThreads);

// Get trending threads
router.get('/threads/trending', optionalAuthenticate, getTrendingThreads);

// Get hot topics
router.get('/topics/hot', optionalAuthenticate, getHotTopics);

// Get active users/contributors
router.get('/users/active', optionalAuthenticate, getActiveUsers);

// Get popular tags
router.get('/tags/popular', optionalAuthenticate, getPopularTags);

// Get recent activity (threads with most recent updates/comments)
router.get('/threads/recent-activity', optionalAuthenticate, async (req, res) => {
  try {
    const { ThreadModel } = await import('../models/thread/index.js');
    const limit = Math.max(1, Math.min(10, parseInt(req.query.limit, 10) || 5));
    const threads = await ThreadModel.find({ isDeleted: { $ne: true } })
      .select('_id title updatedAt commentCount author')
      .populate('author', 'displayName')
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();
    return res.json({
      success: true,
      data: threads.map(t => ({
        _id: t._id,
        title: t.title,
        updatedAt: t.updatedAt,
        commentCount: t.commentCount || 0,
        authorName: t.author?.displayName || 'Unknown',
      })),
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// Get thread categories with counts
router.get('/categories', optionalAuthenticate, getCategories);

// ==================== Pin Thread Routes ====================

// Get all pinned threads with full details
router.get('/threads/pinned/all', optionalAuthenticate, getAllPinnedThreads);

// Pin a thread (Admin/Moderator only)
router.put('/threads/:threadId/pin', authenticate, pinThread);

// Unpin a thread (Admin/Moderator only)
router.put('/threads/:threadId/unpin', authenticate, unpinThread);

// Toggle pin status (convenience method)
router.put('/threads/:threadId/toggle-pin', authenticate, togglePinThread);

// Reorder pinned threads (Admin/Moderator only)
router.put('/threads/pinned/reorder', authenticate, reorderPinnedThreads);

export default router;
