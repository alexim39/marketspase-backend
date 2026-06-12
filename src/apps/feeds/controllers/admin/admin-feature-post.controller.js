import { FeedPostModel } from '../../models/feed/index.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

/**
 * Admin: Feature or unfeature a feed post
 * PATCH /api/v1/feed/admin/posts/:postId/feature
 * Body: { isFeatured: boolean, durationDays?: number }
 */
export const adminToggleFeaturePost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const adminId = req.userId;
  const { isFeatured, durationDays } = req.body;

  if (isFeatured === undefined || isFeatured === null) {
    throw new ApiError(400, 'isFeatured field is required');
  }

  const post = await FeedPostModel.findById(postId);
  if (!post) {
    throw new ApiError(404, 'Feed post not found');
  }

  if (isFeatured === true) {
    const days = Math.min(30, Math.max(1, parseInt(durationDays, 10) || 7));
    post.isFeatured = true;
    post.featuredBy = adminId;
    post.featuredUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  } else {
    post.isFeatured = false;
    post.featuredBy = undefined;
    post.featuredUntil = undefined;
  }

  await post.save();

  return res.status(200).json(
    new ApiResponse(200, {
      _id: post._id,
      isFeatured: post.isFeatured,
      featuredUntil: post.featuredUntil,
      featuredBy: post.featuredBy
    }, isFeatured ? 'Post featured successfully' : 'Post unfeatured successfully')
  );
});
