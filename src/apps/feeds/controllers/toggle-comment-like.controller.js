import { FeedPostModel } from '../models/feed.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Like/Unlike comment (handles both top-level and nested)
export const toggleCommentLike = asyncHandler(async (req, res) => {
  const { postId, commentId } = req.params;
  const { userId } = req.body;

  const post = await FeedPostModel.findById(postId);
  if (!post) throw new ApiError(404, 'Post not found');

  // Find comment (top-level or nested)
  let foundComment = null;
  const topComment = post.comments.id(commentId);
  if (topComment) {
    foundComment = topComment;
  } else {
    for (const c of post.comments) {
      const reply = c.replies?.id(commentId);
      if (reply) {
        foundComment = reply;
        break;
      }
    }
  }
  if (!foundComment) throw new ApiError(404, 'Comment not found');

  const likeIndex = foundComment.likes.findIndex(like => like.toString() === userId.toString());
  if (likeIndex === -1) {
    foundComment.likes.push(userId);
  } else {
    foundComment.likes.splice(likeIndex, 1);
  }

  await post.save();

  // Populate user for response
  await FeedPostModel.populate(foundComment, { path: 'user', select: 'displayName username avatar' });

  const response = foundComment.toObject();
  response.likeCount = response.likes?.length || 0;
  response.isLiked = likeIndex === -1; // after toggle
  delete response.likes;

  return res.status(200).json(
    new ApiResponse(200, response, likeIndex === -1 ? 'Comment liked' : 'Comment unliked')
  );
});
