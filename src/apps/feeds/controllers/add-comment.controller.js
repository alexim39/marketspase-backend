import { FeedPostModel } from '../models/feed/index.js';
import { UserModel } from '../../user/models/user/index.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { autoTrackContractEngagement } from '../../social/services/auto-track-engagement.service.js';

export const addComment = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { content, parentCommentId } = req.body;
  const userId = req.userId;

  const post = await FeedPostModel.findById(postId);
  if (!post) throw new ApiError(404, 'Post not found');
  if (post.settings?.disableComments) {
    throw new ApiError(403, 'Comments are disabled for this post');
  }

  const user = await UserModel.findById(userId).select('username displayName avatar');

  const comment = {
    user: userId,
    content,
    replies: [],
    likes: [],
    createdAt: new Date()
  };

  if (parentCommentId) {
    const parentComment = post.comments.id(parentCommentId);
    if (!parentComment) throw new ApiError(404, 'Parent comment not found');
    parentComment.replies.push(comment);
    await post.save();

    // Get the newly added reply
    const newReply = parentComment.replies[parentComment.replies.length - 1];
    await FeedPostModel.populate(newReply, { path: 'user', select: 'displayName username avatar' });

    // Add computed fields
    const replyObj = newReply.toObject();
    replyObj.likeCount = replyObj.likes?.length || 0;
    replyObj.isLiked = replyObj.likes?.some(like => like.toString() === userId.toString()) || false;
    delete replyObj.likes;

    if (post.author) {
      await autoTrackContractEngagement(userId, post.author.toString(), 'comment');
    }

    return res.status(201).json(new ApiResponse(201, replyObj, 'Reply added'));
  } else {
    post.comments.push(comment);
    await post.save();

    const newComment = post.comments[post.comments.length - 1];
    await FeedPostModel.populate(newComment, { path: 'user', select: 'displayName username avatar' });

    const commentObj = newComment.toObject();
    commentObj.likeCount = commentObj.likes?.length || 0;
    commentObj.isLiked = commentObj.likes?.some(like => like.toString() === userId.toString()) || false;
    delete commentObj.likes;

    if (post.author) {
      await autoTrackContractEngagement(userId, post.author.toString(), 'comment');
    }

    return res.status(201).json(new ApiResponse(201, commentObj, 'Comment added'));
  }
});
