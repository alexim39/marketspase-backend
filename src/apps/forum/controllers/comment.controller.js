import { evaluateUserBadges } from '../../badges/service/badge.service.js';
import { awardGamificationProgress } from '../../gamification/service/gamification.service.js';
import { UserModel } from '../../user/models/user/index.js';
import { CommentModel } from '../models/comment/index.js';
import { ThreadModel } from '../models/thread/index.js';
import {
  notifyForumFollowers,
  shapeForumComment,
} from '../services/forum-social.service.js';

const getAuthenticatedForumUserId = (req) =>
  req.userId || req.user?._id?.toString?.() || null;

const isForumAdmin = (req) =>
  req.user?.role === 'admin' || req.user?.type === 'admin' || req.user?.role === 'marketing_rep';

const populateComment = async (commentId, userId = null) => {
  const comment = await CommentModel.findById(commentId)
    .populate('author', 'displayName username avatar role badgeProfile gamificationProfile')
    .populate({
      path: 'replies',
      match: { isDeleted: false },
      options: { sort: { createdAt: 1 } },
      populate: {
        path: 'author',
        select: 'displayName username avatar role badgeProfile gamificationProfile',
      },
    })
    .lean();

  return comment ? shapeForumComment(comment, userId) : null;
};

export const addCommentToThread = async (req, res) => {
  try {
    const { threadId, content } = req.body;
    const authorId = getAuthenticatedForumUserId(req);

    if (!threadId || !content || !authorId) {
      return res.status(400).json({
        success: false,
        message: 'Thread and comment content are required',
      });
    }

    const [thread, author] = await Promise.all([
      ThreadModel.findById(threadId).select('title author isLocked followers topicTags tags category').lean(),
      UserModel.findById(authorId).select('displayName username role').lean(),
    ]);

    if (!thread) {
      return res.status(404).json({
        success: false,
        message: 'Thread not found',
      });
    }

    if (thread.isLocked) {
      return res.status(403).json({
        success: false,
        message: 'Cannot comment on a locked thread',
      });
    }

    const authorAlreadyFollowing = (thread.followers || []).some((entry) => entry?.toString?.() === authorId);

    const newComment = await CommentModel.create({
      content,
      author: authorId,
      thread: threadId,
      parentComment: null,
      isReply: false,
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || '',
        source: 'web',
      },
    });

    await Promise.all([
      ThreadModel.updateOne(
        { _id: threadId },
        {
          $inc: authorAlreadyFollowing ? { commentCount: 1 } : { commentCount: 1, followerCount: 1 },
          $set: {
            lastCommentBy: authorId,
            lastCommentAt: new Date(),
            lastActivityAt: new Date(),
          },
          $addToSet: { followers: authorId },
        },
      ),
      UserModel.updateOne(
        { _id: authorId },
        {
          $addToSet: {
            'forumActivity.comments': newComment._id,
            'forumActivity.followedThreads': threadId,
          },
        },
      ),
    ]);

    const populatedComment = await populateComment(newComment._id, authorId);

    await awardGamificationProgress({
      userId: authorId,
      actionKey: 'forum_comment_created',
      sourceKey: `forum-comment:${newComment._id}`,
      sourceType: 'forum_comment',
      sourceId: newComment._id?.toString?.() || null,
      metadata: {
        threadId,
        commentId: newComment._id?.toString?.() || null,
        isReply: false,
      },
    }).catch((error) => {
      console.error('Gamification award for forum comment failed:', error);
    });

    await evaluateUserBadges(authorId, {
      trigger: 'forum_comment_created',
    }).catch((error) => {
      console.error('Badge evaluation after forum comment failed:', error);
    });

    await notifyForumFollowers({
      thread,
      actorId: authorId,
      actorDisplayName: author?.displayName || author?.username || 'A community member',
      eventType: 'new_comment',
      previewText: String(content).trim().slice(0, 120),
    }).catch((error) => {
      console.error('Failed to notify forum followers about new comment:', error);
    });

    return res.status(201).json({
      success: true,
      data: populatedComment,
      message: 'Comment added successfully',
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add comment',
      error: error.message,
    });
  }
};

export const addCommentReply = async (req, res) => {
  try {
    const { content, commentId } = req.body;
    const authorId = getAuthenticatedForumUserId(req);

    if (!commentId || !content || !authorId) {
      return res.status(400).json({
        success: false,
        message: 'Reply content is required',
      });
    }

    const [parentComment, author] = await Promise.all([
      CommentModel.findById(commentId).select('thread author').lean(),
      UserModel.findById(authorId).select('displayName username role').lean(),
    ]);

    if (!parentComment) {
      return res.status(404).json({
        success: false,
        message: 'Parent comment not found',
      });
    }

    const thread = await ThreadModel.findById(parentComment.thread)
      .select('title author isLocked followers topicTags tags category')
      .lean();

    if (!thread) {
      return res.status(404).json({
        success: false,
        message: 'Thread not found',
      });
    }

    if (thread.isLocked) {
      return res.status(403).json({
        success: false,
        message: 'Cannot reply in a locked thread',
      });
    }

    const authorAlreadyFollowing = (thread.followers || []).some((entry) => entry?.toString?.() === authorId);

    const reply = await CommentModel.create({
      content,
      author: authorId,
      thread: parentComment.thread,
      parentComment: commentId,
      isReply: true,
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || '',
        source: 'web',
      },
    });

    await Promise.all([
      CommentModel.updateOne(
        { _id: commentId },
        {
          $addToSet: { replies: reply._id },
          $inc: { replyCount: 1 },
        },
      ),
      ThreadModel.updateOne(
        { _id: parentComment.thread },
        {
          $inc: authorAlreadyFollowing ? { commentCount: 1 } : { commentCount: 1, followerCount: 1 },
          $set: {
            lastCommentBy: authorId,
            lastCommentAt: new Date(),
            lastActivityAt: new Date(),
          },
          $addToSet: { followers: authorId },
        },
      ),
      UserModel.updateOne(
        { _id: authorId },
        {
          $addToSet: {
            'forumActivity.comments': reply._id,
            'forumActivity.followedThreads': parentComment.thread,
          },
        },
      ),
    ]);

    const populatedReply = await populateComment(reply._id, authorId);

    await awardGamificationProgress({
      userId: authorId,
      actionKey: 'forum_comment_created',
      sourceKey: `forum-reply:${reply._id}`,
      sourceType: 'forum_reply',
      sourceId: reply._id?.toString?.() || null,
      metadata: {
        threadId: parentComment.thread?.toString?.() || null,
        commentId: reply._id?.toString?.() || null,
        parentCommentId: commentId,
        isReply: true,
      },
    }).catch((error) => {
      console.error('Gamification award for forum reply failed:', error);
    });

    await evaluateUserBadges(authorId, {
      trigger: 'forum_reply_created',
    }).catch((error) => {
      console.error('Badge evaluation after forum reply failed:', error);
    });

    await notifyForumFollowers({
      thread,
      actorId: authorId,
      actorDisplayName: author?.displayName || author?.username || 'A community member',
      eventType: 'new_reply',
      previewText: String(content).trim().slice(0, 120),
    }).catch((error) => {
      console.error('Failed to notify forum followers about new reply:', error);
    });

    return res.status(201).json({
      success: true,
      data: populatedReply,
      message: 'Reply added successfully',
    });
  } catch (error) {
    console.error('Error adding reply:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add reply',
      error: error.message,
    });
  }
};

export const toggleLikeComment = async (req, res) => {
  try {
    const { commentId } = req.body;
    const userId = getAuthenticatedForumUserId(req);

    if (!commentId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Comment ID is required',
      });
    }

    const [comment, user] = await Promise.all([
      CommentModel.findById(commentId),
      UserModel.findById(userId).select('forumActivity.likedComments'),
    ]);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found',
      });
    }

    const alreadyLiked = (user?.forumActivity?.likedComments || []).some((entry) => entry?.toString?.() === commentId);

    await Promise.all([
      CommentModel.updateOne(
        { _id: commentId },
        alreadyLiked
          ? { $inc: { likeCount: -1 }, $pull: { likedBy: userId } }
          : { $inc: { likeCount: 1 }, $addToSet: { likedBy: userId } },
      ),
      UserModel.updateOne(
        { _id: userId },
        alreadyLiked
          ? { $pull: { 'forumActivity.likedComments': commentId } }
          : { $addToSet: { 'forumActivity.likedComments': commentId } },
      ),
    ]);

    const updatedComment = await populateComment(commentId, userId);
    return res.status(200).json({
      success: true,
      data: updatedComment,
      liked: !alreadyLiked,
      message: alreadyLiked ? 'Comment unliked' : 'Comment liked',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error toggling like on comment',
      error: error.message,
    });
  }
};

export const toggleLikeReply = async (req, res) => {
  req.body.commentId = req.body.replyId;
  return toggleLikeComment(req, res);
};

export const deleteReply = async (req, res) => {
  try {
    const { replyId } = req.params;
    const userId = getAuthenticatedForumUserId(req);

    const reply = await CommentModel.findById(replyId).lean();
    if (!reply) {
      return res.status(404).json({
        success: false,
        message: 'Reply not found',
      });
    }

    if (!reply.parentComment) {
      return res.status(400).json({
        success: false,
        message: 'This is not a reply',
      });
    }

    if (reply.author?.toString?.() !== userId && !isForumAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this reply',
      });
    }

    await Promise.all([
      CommentModel.deleteOne({ _id: replyId }),
      CommentModel.updateOne(
        { _id: reply.parentComment },
        {
          $pull: { replies: replyId },
          $inc: { replyCount: -1 },
        },
      ),
      ThreadModel.updateOne(
        { _id: reply.thread },
        {
          $inc: { commentCount: -1 },
          $set: { lastActivityAt: new Date() },
        },
      ),
      UserModel.updateMany(
        {},
        {
          $pull: {
            'forumActivity.comments': replyId,
            'forumActivity.likedComments': replyId,
          },
        },
      ),
    ]);

    return res.status(200).json({
      success: true,
      message: 'Reply deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting reply:', error);
    return res.status(500).json({
      success: false,
      message: 'Error deleting reply',
      error: error.message,
    });
  }
};

export const deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = getAuthenticatedForumUserId(req);

    const comment = await CommentModel.findById(commentId).lean();
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found',
      });
    }

    if (comment.author?.toString?.() !== userId && !isForumAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this comment',
      });
    }

    const replyIds = (comment.replies || []).map((entry) => entry?.toString?.()).filter(Boolean);
    const removedCount = 1 + replyIds.length;

    await Promise.all([
      CommentModel.deleteMany({
        $or: [
          { _id: commentId },
          { parentComment: commentId },
        ],
      }),
      comment.parentComment
        ? CommentModel.updateOne(
            { _id: comment.parentComment },
            {
              $pull: { replies: commentId },
              $inc: { replyCount: -1 },
            },
          )
        : Promise.resolve(),
      ThreadModel.updateOne(
        { _id: comment.thread },
        {
          $inc: { commentCount: -removedCount },
          $set: { lastActivityAt: new Date() },
        },
      ),
      UserModel.updateMany(
        {},
        {
          $pull: {
            'forumActivity.comments': { $in: [commentId, ...replyIds] },
            'forumActivity.likedComments': { $in: [commentId, ...replyIds] },
          },
        },
      ),
    ]);

    return res.status(200).json({
      success: true,
      message: 'Comment deleted successfully',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error deleting comment',
      error: error.message,
    });
  }
};

export const updateComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;
    const userId = getAuthenticatedForumUserId(req);

    const comment = await CommentModel.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found',
      });
    }

    if (comment.isDeleted) {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit a deleted comment',
      });
    }

    if (comment.author?.toString?.() !== userId && !isForumAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: 'You are not the author of this comment',
      });
    }

    comment.content = content;
    comment.isEdited = true;
    comment.lastEditedAt = new Date();
    await comment.save();

    const updatedComment = await populateComment(commentId, userId);
    return res.status(200).json({
      success: true,
      data: updatedComment,
    });
  } catch (error) {
    console.error('Error updating comment:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

export const deleteComment_soft = deleteComment;
export const deleteReply_soft = deleteReply;
