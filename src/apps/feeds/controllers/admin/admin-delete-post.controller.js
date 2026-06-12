import { FeedPostModel } from '../../models/feed/index.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

/**
 * Admin: Permanently delete a feed post (soft delete by changing status)
 * DELETE /api/v1/feed/admin/posts/:postId
 */
export const adminDeletePost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { permanent } = req.query;

  const post = await FeedPostModel.findById(postId);
  if (!post) {
    throw new ApiError(404, 'Feed post not found');
  }

  if (permanent === 'true') {
    await FeedPostModel.findByIdAndDelete(postId);
  } else {
    post.status = 'archived';
    post.isFeatured = false;
    post.featuredBy = undefined;
    post.featuredUntil = undefined;
    await post.save();
  }

  return res.status(200).json(
    new ApiResponse(200, { _id: postId }, 'Post deleted successfully')
  );
});
