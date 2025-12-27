import { UserModel } from '../../user/models/user.model.js';
import { ThreadModel } from './../models/thread.model.js';
import { CommentModel } from '../models/comment.model.js';

/**
 * @desc    Add a top-level comment to a thread
 * @route   POST /api/forum/threads/:threadId/comments
 * @access  Private
 */
export const addCommentToThread = async (req, res) => {
  try {
    // const { threadId } = req.params;
    // const { content } = req.body;
    // const authorId = req.user.id;
    const {threadId, content, authorId } = req.body;

    // Validate thread exists and isn't locked
    const thread = await ThreadModel.findById(threadId);
    if (!thread) {
      return res.status(404).json({
        success: false,
        message: 'Thread not found'
      });
    }

    if (thread.isLocked) {
      return res.status(403).json({
        success: false,
        message: 'Cannot comment on a locked thread'
      });
    }

    // Create and save comment
    const newComment = new CommentModel({
      content,
      author: authorId,
      thread: threadId,
      parentComment: null // Explicitly null for top-level
    });

    const savedComment = await newComment.save();

    // Update thread's comment count
    await ThreadModel.findByIdAndUpdate(threadId, {
      $inc: { commentCount: 1 },
      $set: { updatedAt: new Date() }
    });

    // Update user's forum activity
    await UserModel.findByIdAndUpdate(authorId, {
      $push: { 'forumActivity.comments': savedComment._id }
    });

    // Populate and return response
    const populatedComment = await CommentModel.findById(savedComment._id)
      .populate('author', 'name username avatar')
      .lean();

    res.status(201).json({
      success: true,
      data: {
        ...populatedComment,
        replyCount: 0,
        likeCount: 0,
        isLiked: false
      },
      message: 'Comment added successfully'
    });

  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add comment',
      error: error.message
    });
  }
};

/**
 * @desc    Add a reply to a comment
 * @route   POST /api/forum/comments/:commentId/replies
 * @access  Private
 */
// In your backend controller
export const addCommentReply = async (req, res) => {
  try {
    const { content, authorId, commentId } = req.body; // Remove threadId from body

    // 1. Get parent comment and thread ID
    const parentComment = await CommentModel.findById(commentId);
    if (!parentComment) {
      return res.status(404).json({ success: false, message: 'Parent comment not found' });
    }

    const threadId = parentComment.thread;

    // 2. Create reply with proper parent reference
    const newReply = new CommentModel({
      content,
      author: authorId,
      thread: threadId,
      parentComment: commentId,
      isReply: true // Mark as reply
    });

    const savedReply = await newReply.save();

    // 3. Update parent comment's replies array
    await CommentModel.findByIdAndUpdate(commentId, {
      $push: { replies: savedReply._id },
      $inc: { replyCount: 1 }
    });

    // 4. Return populated reply
    const populatedReply = await CommentModel.findById(savedReply._id)
      .populate('author', 'name username avatar')
      .lean();

    res.status(201).json({
      success: true,
      data: {
        ...populatedReply,
        isReply: true, // Ensure this is set
        replyCount: 0,
        likeCount: 0,
        isLiked: false
      }
    });

  } catch (error) {
    console.error('Error adding reply:', error);
    res.status(500).json({ success: false, message: 'Failed to add reply' });
  }
};

/**
 * @desc    Toggle like on a comment
 * @route   PUT /api/forum/comments/:commentId/like
 * @access  Public
 */
export const toggleLikeComment = async (req, res) => {
  try {
    const { commentId, userId } = req.body;

    //console.log('Toggle like comment request:', { commentId, userId });

    if (!commentId || !userId) {
      return res.status(400).json({success: false, message: 'Comment ID and User ID are required' });
    }

    // Find the comment
    const comment = await CommentModel.findById(commentId);
    if (!comment) {
      return res.status(404).json({success: false, message: 'Comment not found' });
    }

    // Check if user already liked the comment
    const user = await UserModel.findById(userId);
    const alreadyLiked = user.forumActivity.likedComments.includes(commentId);

    if (alreadyLiked) {
      // Unlike the comment
      await CommentModel.updateOne(
        { _id: commentId },
        { $inc: { likeCount: -1 } }
      );
      await UserModel.updateOne(
        { _id: userId },
        { $pull: { 'forumActivity.likedComments': commentId } }
      );
      res.status(200).json({ success: true, message: 'Comment unliked', liked: false });
    } else {
      // Like the comment
      await CommentModel.updateOne(
        { _id: commentId },
        { $inc: { likeCount: 1 } }
      );
      await UserModel.updateOne(
        { _id: userId },
        { $addToSet: { 'forumActivity.likedComments': commentId } }
      );
      res.status(200).json({ success: true, message: 'Comment liked', liked: true });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error toggling like on comment', error: error.message });
  }
};


/**
 * @desc    Get all comments for a thread
 * @route   GET /api/forum/threads/:threadId/comments
 */
 export const toggleLikeReply = async (req, res) => {
  try {
    const { replyId, userId } = req.body;

    // Find the reply
    const reply = await CommentModel.findById(replyId);
    if (!reply) {
      return res.status(404).json({success: false, message: 'Reply not found' });
    }

    // Check if it's actually a reply
    if (!reply.parentComment) {
      return res.status(400).json({success: false, message: 'This is not a reply' });
    }

    // Check if user already liked the reply
    const user = await UserModel.findById(userId);
    const alreadyLiked = user.forumActivity.likedComments.includes(replyId);

    if (alreadyLiked) {
      // Unlike the reply
      await CommentModel.updateOne(
        { _id: replyId },
        { $inc: { likeCount: -1 } }
      );
      await UserModel.updateOne(
        { _id: userId },
        { $pull: { 'forumActivity.likedComments': replyId } }
      );
      res.status(200).json({success: true, message: 'Reply unliked', liked: false });
    } else {
      // Like the reply
      await CommentModel.updateOne(
        { _id: replyId },
        { $inc: { likeCount: 1 } }
      );
      await UserModel.updateOne(
        { _id: userId },
        { $addToSet: { 'forumActivity.likedComments': replyId } }
      );
      res.status(200).json({success: true, message: 'Reply liked', liked: true });
    }
  } catch (error) {
    res.status(500).json({success: false, message: 'Error toggling like on reply', error: error.message });
  }
};

/**
 @desc    Delete a comment (soft delete)
 * @route   DELETE /api/forum/comments/:commentId
 * @access  Private
 */
export const deleteComment_soft = async (req, res) => {
  try {
    const { commentId, userId } = req.params;

    //console.log('Delete comment request:', { commentId, userId });return;

    if (!commentId || !userId) {
      return res.status(400).json({success: false, message: 'Comment ID and User ID are required' });
    }

    // Find the comment
    const comment = await CommentModel.findById(commentId);
    if (!comment) {
      return res.status(404).json({success: false, message: 'Comment not found' });
    }

    // Check if the user is the author or an admin
    if (!comment.author.equals(userId) && req.user.role !== 'admin') {
      return res.status(403).json({success: false, message: 'Not authorized to delete this comment' });
    }

    // For soft delete (mark as deleted but keep in DB)
    comment.isDeleted = true;
    await comment.save();

    // Or for hard delete:
    // await CommentModel.deleteOne({ _id: commentId });

    // Decrement comment count on the thread (if hard delete)
    await ThreadModel.updateOne(
      { _id: comment.thread },
      { $inc: { commentCount: -1 } }
    );

    // Remove comment from user's forumActivity.comments array
    await UserModel.updateOne(
      { _id: userId },
      { $pull: { 'forumActivity.comments': commentId } }
    );

    res.status(200).json({success: true, message: 'Comment deleted successfully' });
  } catch (error) {
    res.status(500).json({success: false, message: 'Error deleting comment', error: error.message });
  }
};


/**
 * @desc   Delete a reply (soft delete)
 */
export const deleteReply_soft = async (req, res) => {
  try {
    const { replyId, userId} = req.params;

    if (!replyId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Reply ID is required' 
      });
    }

    // Find the reply and populate the thread reference
    const reply = await CommentModel.findById(replyId)
      .populate('thread', 'commentCount');
    
    if (!reply) {
      return res.status(404).json({ 
        success: false, 
        message: 'Reply not found' 
      });
    }

    // Check if it's actually a reply
    if (!reply.parentComment) {
      return res.status(400).json({ 
        success: false, 
        message: 'This is not a reply' 
      });
    }

    // Authorization check
    if (!reply.author.equals(userId) && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to delete this reply' 
      });
    }

    // Soft delete the reply
    reply.isDeleted = true;
    reply.content = "[deleted]"; // Optionally clear content
    await reply.save();

    // Update parent thread's comment count
    await ThreadModel.updateOne(
      { _id: reply.thread._id },
      { $inc: { commentCount: -1 } }
    );

    // Remove from user's activity arrays
    await UserModel.updateOne(
      { _id: userId },
      { 
        $pull: { 
          'forumActivity.comments': replyId,
          'forumActivity.likedComments': replyId
        } 
      }
    );

    res.status(200).json({ 
      success: true, 
      message: 'Reply deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting reply:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error deleting reply', 
      error: error.message 
    });
  }
};


// Hard delete reply
// This will remove the reply from the database and update the parent comment and thread counts
export const deleteReply = async (req, res) => {
  try {
    const { replyId, userId } = req.params;

    if (!replyId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Reply ID is required' 
      });
    }

    // Find the reply and populate the thread reference
    const reply = await CommentModel.findById(replyId)
      .populate('thread', 'commentCount');
    
    if (!reply) {
      return res.status(404).json({ 
        success: false, 
        message: 'Reply not found' 
      });
    }

    // Check if it's actually a reply
    if (!reply.parentComment) {
      return res.status(400).json({ 
        success: false, 
        message: 'This is not a reply' 
      });
    }

    // Authorization check
    if (!reply.author.equals(userId) && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to delete this reply' 
      });
    }

    // Hard delete the reply
    await CommentModel.deleteOne({ _id: replyId });

    // Remove reply reference from parent comment's replies array
    await CommentModel.findByIdAndUpdate(
      reply.parentComment,
      { $pull: { replies: replyId }, $inc: { replyCount: -1 } }
    );

    // Update parent thread's comment count
   /*  await ThreadModel.updateOne(
      { _id: reply.thread._id },
      { $inc: { commentCount: -1 } }
    ); */

    // Remove from user's activity arrays
    await UserModel.updateOne(
      { _id: userId },
      { 
        $pull: { 
          'forumActivity.comments': replyId,
          'forumActivity.likedComments': replyId
        } 
      }
    );

    res.status(200).json({ 
      success: true, 
      message: 'Reply deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting reply:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error deleting reply', 
      error: error.message 
    });
  }
};

// Hard delete comment
// This will remove the comment from the database and update the thread and user activity counts
export const deleteComment = async (req, res) => {
  try {
    const { commentId, userId } = req.params;

    if (!commentId || !userId) {
      return res.status(400).json({ success: false, message: 'Comment ID and User ID are required' });
    }

    // Find the comment
    const comment = await CommentModel.findById(commentId);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    // Check if the user is the author or an admin
    if (!comment.author.equals(userId) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this comment' });
    }

    // Hard delete the comment
    await CommentModel.deleteOne({ _id: commentId });

    // Remove comment from parent's replies array if it's a reply
    if (comment.parentComment) {
      await CommentModel.findByIdAndUpdate(
        comment.parentComment,
        { $pull: { replies: commentId }, $inc: { replyCount: -1 } }
      );
    }

    // Remove all replies to this comment (cascade delete)
    await CommentModel.deleteMany({ parentComment: commentId });

    // Decrement comment count on the thread
    await ThreadModel.updateOne(
      { _id: comment.thread },
      { $inc: { commentCount: -1 } }
    );

    // Remove comment from user's forumActivity.comments array
    await UserModel.updateOne(
      { _id: userId },
      { $pull: { 'forumActivity.comments': commentId } }
    );

    res.status(200).json({ success: true, message: 'Comment deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting comment', error: error.message });
  }
};