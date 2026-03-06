import { FeedPostModel } from '../models/feed.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Get comments for a post with pagination
export const getPostComments = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  let { page = 1, limit = 20, userId } = req.query;
  page = parseInt(page);
  limit = parseInt(limit);

  const post = await FeedPostModel.findById(postId)
    .select('comments')
    .populate('comments.user', 'displayName username avatar')
    .populate('comments.replies.user', 'displayName username avatar')
    .lean();

  if (!post) throw new ApiError(404, 'Post not found');

  let allComments = post.comments || [];
  const start = (page - 1) * limit;
  const paginatedComments = allComments.slice(start, start + limit);

  // Process comments and replies
  const processed = paginatedComments.map(comment => {
    // Top-level comment
    const c = { ...comment };
    c.likeCount = c.likes?.length || 0;
    c.isLiked = userId ? (c.likes?.some(like => like.toString() === userId.toString()) || false) : false;
    delete c.likes;

    // Process replies
    if (c.replies && c.replies.length) {
      c.replies = c.replies.map(reply => {
        const r = { ...reply };
        r.likeCount = r.likes?.length || 0;
        r.isLiked = userId ? (r.likes?.some(like => like.toString() === userId.toString()) || false) : false;
        delete r.likes;
        return r;
      });
    }
    return c;
  });

  return res.status(200).json(
    new ApiResponse(200, {
      comments: processed,
      total: allComments.length,
      page,
      pages: Math.ceil(allComments.length / limit)
    }, 'Comments fetched successfully')
  );
});